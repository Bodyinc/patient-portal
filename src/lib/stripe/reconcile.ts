import "server-only";

import type Stripe from "stripe";
import { stripe } from "./server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordPayment } from "./record-payment";
import { maybeConvertReferral } from "@/lib/referrals";
import { recordInvoiceWalletDebit } from "@/lib/wallet";
import type { Json } from "@/lib/supabase/types";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];
// Only these local states can still become active by pulling Stripe truth. Terminal states
// (canceled, unpaid, incomplete_expired) never self-heal, so we must not hit Stripe for them
// on every hot-path load.
const RECONCILABLE_STATUSES = ["incomplete"];

// Fast, Stripe-free check: an active subscription plus a recorded succeeded payment means the
// webhook (or a prior reconcile) already did the work, so there is nothing left to self-heal.
async function alreadyReconciled(userId: string): Promise<boolean> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_SUBSCRIPTION_STATUSES])
    .limit(1)
    .maybeSingle();
  if (!sub) return false;

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "succeeded")
    .limit(1)
    .maybeSingle();
  return Boolean(payment);
}

function periodEndIso(sub: Stripe.Subscription): string | null {
  const anySub = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = anySub.current_period_end ?? anySub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const pi = (invoice as unknown as { payment_intent?: string | { id?: string } }).payment_intent;
  if (typeof pi === "string") return pi;
  return pi?.id ?? null;
}

async function backfillOrphanStripeRows(userId: string, sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  await supabaseAdmin
    .from("subscriptions")
    .update({ user_id: userId })
    .eq("session_id", sessionId)
    .is("user_id", null);
  await supabaseAdmin
    .from("payments")
    .update({ user_id: userId })
    .eq("session_id", sessionId)
    .is("user_id", null);
  await supabaseAdmin
    .from("medication_requests")
    .update({ user_id: userId })
    .eq("session_id", sessionId)
    .is("user_id", null);
}

async function resolveStripeSubscriptionForUser(userId: string): Promise<{
  stripeSubscriptionId: string | null;
  sessionId: string | null;
}> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, session_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub?.stripe_subscription_id) {
    return {
      stripeSubscriptionId: sub.stripe_subscription_id,
      sessionId: sub.session_id,
    };
  }

  const { data: intake } = await supabaseAdmin
    .from("intake_sessions")
    .select("id, stripe_subscription_id")
    .eq("claimed_by_user_id", userId)
    .not("stripe_subscription_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (intake?.stripe_subscription_id) {
    return {
      stripeSubscriptionId: intake.stripe_subscription_id,
      sessionId: intake.id,
    };
  }

  if (intake?.id) {
    const { data: orphanSub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, session_id")
      .eq("session_id", intake.id)
      .not("stripe_subscription_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orphanSub?.stripe_subscription_id) {
      return {
        stripeSubscriptionId: orphanSub.stripe_subscription_id,
        sessionId: orphanSub.session_id ?? intake.id,
      };
    }
  }

  return { stripeSubscriptionId: null, sessionId: null };
}

// Pull the current truth from Stripe and write it to our DB — the same effect the webhook
// has, but callable on demand (confirmation page + backfill) so orders confirm even when the
// webhook is delayed or misconfigured. Idempotent.
export async function reconcileSubscription(stripeSubscriptionId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice"],
  });
  const meta = sub.metadata ?? {};
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);

  const volatile = {
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    status: sub.status,
    current_period_end: periodEndIso(sub),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };

  const { data: updated } = await supabaseAdmin
    .from("subscriptions")
    .update(volatile)
    .eq("stripe_subscription_id", sub.id)
    .select("id, user_id, session_id, package_id");

  let subRow = updated?.[0] ?? null;
  if (!subRow) {
    const { data: inserted } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        stripe_subscription_id: sub.id,
        ...volatile,
        user_id: meta.user_id || null,
        session_id: meta.intake_session_id || null,
        package_id: meta.package_id || null,
        medicine_id: meta.medicine_id || null,
      })
      .select("id, user_id, session_id, package_id")
      .maybeSingle();
    subRow = inserted ?? null;
  }

  const invoice = sub.latest_invoice;
  const paid =
    invoice &&
    typeof invoice !== "string" &&
    (invoice.status === "paid" || (invoice.amount_paid ?? 0) > 0);

  if (paid && typeof invoice !== "string") {
    const piId = invoicePaymentIntentId(invoice);
    await recordPayment({
      user_id: subRow?.user_id ?? meta.user_id ?? null,
      session_id: subRow?.session_id ?? meta.intake_session_id ?? null,
      plan_id: subRow?.package_id ?? meta.package_id ?? null,
      stripe_subscription_id: sub.id,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: piId,
      stripe_customer_id: customerId,
      amount_cents: invoice.amount_paid ?? invoice.total ?? 0,
      currency: invoice.currency ?? "usd",
      status: "succeeded",
      raw_event: invoice as unknown as Json,
    });

    await supabaseAdmin
      .from("shop_checkout_orders")
      .update({
        status: "paid",
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: piId,
      })
      .eq("stripe_subscription_id", sub.id);

    if (subRow?.session_id) {
      await supabaseAdmin
        .from("intake_sessions")
        .update({ status: "completed" })
        .eq("id", subRow.session_id);
    }

    // Locally (no webhook) this reconcile is what first records the payment, so it must
    // also run the referral conversion check the webhook would normally perform.
    const paidUserId = subRow?.user_id ?? meta.user_id ?? null;
    if (paidUserId) {
      try {
        await maybeConvertReferral(paidUserId);
      } catch (error) {
        console.error("[referrals] convert on reconcile failed:", error);
      }
      await recordInvoiceWalletDebit(invoice, paidUserId);
    }
  }
}

// Convenience wrapper used by the confirmation pages and post-claim self-heal.
export async function reconcileLatestSubscriptionForUser(userId: string): Promise<void> {
  // Once the webhook has activated the sub and recorded the payment, there is nothing to pull
  // from Stripe — skip the live round-trip so confirmation/dashboard render straight from DB.
  if (await alreadyReconciled(userId)) return;

  const { stripeSubscriptionId, sessionId } = await resolveStripeSubscriptionForUser(userId);
  if (!stripeSubscriptionId) return;

  await backfillOrphanStripeRows(userId, sessionId);

  try {
    await reconcileSubscription(stripeSubscriptionId);
  } catch (error) {
    console.error("[stripe] reconcileLatestSubscriptionForUser failed:", error);
  }
}

/**
 * If the user has no active subscription but still has an `incomplete` one (common when
 * onboarding paid before webhooks ran), pull Stripe truth once so dashboard/My Meds heal.
 * Returns whether a reconcile was attempted.
 */
export async function maybeReconcileIncompleteSubscription(userId: string): Promise<boolean> {
  const { data: active } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_SUBSCRIPTION_STATUSES])
    .limit(1)
    .maybeSingle();
  if (active) return false;

  const { stripeSubscriptionId, sessionId } = await resolveStripeSubscriptionForUser(userId);
  if (!stripeSubscriptionId) return false;

  const { data: subRow } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  // Reconcile only when the local row can still transition to active (or doesn't exist yet).
  // Terminal states (canceled/unpaid/incomplete_expired) would otherwise hit Stripe on every
  // dashboard/billing/my-meds load forever.
  if (subRow && !RECONCILABLE_STATUSES.includes(subRow.status)) return false;

  await backfillOrphanStripeRows(userId, sessionId);

  try {
    await reconcileSubscription(stripeSubscriptionId);
    return true;
  } catch (error) {
    console.error("[stripe] maybeReconcileIncompleteSubscription failed:", error);
    return false;
  }
}
