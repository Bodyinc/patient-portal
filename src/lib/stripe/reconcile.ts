import "server-only";

import type Stripe from "stripe";
import { stripe } from "./server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordPayment } from "./record-payment";
import type { Json } from "@/lib/supabase/types";

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
  }
}

// Convenience wrapper used by the authenticated confirmation page.
export async function reconcileLatestSubscriptionForUser(userId: string): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub?.stripe_subscription_id) {
    try {
      await reconcileSubscription(sub.stripe_subscription_id);
    } catch {
      // Non-fatal; the webhook remains the backstop.
    }
  }
}
