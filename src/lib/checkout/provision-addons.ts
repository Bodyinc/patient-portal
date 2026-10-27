import "server-only";

import type Stripe from "stripe";

import { sessionRequiresConsultation } from "@/lib/consultations/eligibility";
import { ensureMedicationOrderForPayment } from "@/lib/orders/ensure-medication-order";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

function paymentMethodId(value: string | Stripe.PaymentMethod | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : (value.id ?? null);
}

function addMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * After the primary subscription's first invoice is paid, open a trialing
 * subscription per add-on. The first period was already charged on the
 * primary invoice, so these subscriptions do not bill again until renewal.
 * They share the primary subscription's consultation.
 */
export async function provisionAddonSubscriptions(params: {
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
}): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(params.stripeSubscriptionId);
  if (subscription.metadata?.role === "addon") return;
  if (subscription.metadata?.addons_provisioned === "1") return;

  const packageIds = (subscription.metadata?.addon_package_ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (packageIds.length === 0) return;

  const { data: primary, error: primaryError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, session_id, stripe_customer_id")
    .eq("stripe_subscription_id", params.stripeSubscriptionId)
    .maybeSingle();

  if (primaryError || !primary) {
    throw new Error(primaryError?.message ?? "Primary subscription was not found.");
  }

  await supabaseAdmin
    .from("subscriptions")
    .update({ checkout_group_id: primary.id, is_checkout_primary: true })
    .eq("id", primary.id);

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) throw new Error("Primary subscription is missing a customer.");

  const defaultPaymentMethodId = paymentMethodId(subscription.default_payment_method);
  const { data: packages, error: packageError } = await supabaseAdmin
    .from("packages")
    .select("id, medicine_id, variant_id, name, stripe_price_id, duration_months, medicines(name)")
    .in("id", packageIds);

  if (packageError) throw new Error(packageError.message);

  const packageById = new Map((packages ?? []).map((pkg) => [pkg.id, pkg]));

  for (const packageId of packageIds) {
    const pkg = packageById.get(packageId);
    if (!pkg?.stripe_price_id || !pkg.medicine_id) {
      throw new Error("An added product is missing a billable plan.");
    }

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("checkout_group_id", primary.id)
      .eq("package_id", pkg.id)
      .eq("is_checkout_primary", false)
      .maybeSingle();
    if (existing) continue;

    const durationMonths = Math.max(1, pkg.duration_months ?? 1);
    const trialEnd = Math.floor(addMonths(new Date(), durationMonths).getTime() / 1000);
    const medicineName =
      (pkg as { medicines?: { name: string } | null }).medicines?.name ?? "Treatment";

    const created = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: pkg.stripe_price_id }],
        trial_end: trialEnd,
        ...(defaultPaymentMethodId ? { default_payment_method: defaultPaymentMethodId } : {}),
        description: `${medicineName} · ${pkg.name ?? "Plan"}`,
        metadata: {
          role: "addon",
          intake_session_id: subscription.metadata?.intake_session_id ?? primary.session_id ?? "",
          package_id: pkg.id,
          medicine_id: pkg.medicine_id,
          ...(pkg.variant_id ? { variant_id: pkg.variant_id } : {}),
          checkout_primary_stripe_subscription_id: params.stripeSubscriptionId,
        },
      },
      { idempotencyKey: `addon-${params.stripeSubscriptionId}-${pkg.id}` },
    );

    const { data: addonRow, error: insertError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: primary.user_id,
          session_id: primary.session_id,
          stripe_subscription_id: created.id,
          stripe_customer_id: customerId,
          stripe_price_id: pkg.stripe_price_id,
          package_id: pkg.id,
          medicine_id: pkg.medicine_id,
          status: created.status,
          current_period_end: new Date(trialEnd * 1000).toISOString(),
          is_checkout_primary: false,
          checkout_group_id: primary.id,
        },
        { onConflict: "stripe_subscription_id" },
      )
      .select("id, stripe_subscription_id")
      .single();

    if (insertError || !addonRow) {
      throw new Error(insertError?.message ?? "Unable to save an added subscription.");
    }

    // The payment trigger writes the medication request, the same way it does
    // for the primary plan. If that invoice was recorded before this row existed,
    // create the request from that payment now.
    await ensureOrderForSubscription(addonRow.stripe_subscription_id);
  }

  await stripe.subscriptions.update(params.stripeSubscriptionId, {
    metadata: { ...subscription.metadata, addons_provisioned: "1" },
  });
  await alignPrimaryConsultationFlag(primary.id, primary.session_id);
}

/** The primary request carries the one consultation when any medicine in the cart needs it. */
async function alignPrimaryConsultationFlag(
  primarySubscriptionId: string,
  sessionId: string | null,
): Promise<void> {
  if (!(await sessionRequiresConsultation(sessionId))) return;
  await supabaseAdmin
    .from("medication_requests")
    .update({ requires_consultation: true })
    .eq("subscription_id", primarySubscriptionId)
    .eq("kind", "initial")
    .in("status", ["pending_review", "payment_completed", "provider_assigned"]);
}

/**
 * The paid checkout already stored every medicine on the intake session.
 * Open the same subscription + medication request the primary plan gets
 * for any add-on that is still missing.
 */
export async function ensureCheckoutAddons(userId: string): Promise<void> {
  const { data: primaries, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, session_id, stripe_subscription_id")
    .eq("user_id", userId)
    .eq("is_checkout_primary", true)
    .in("status", ["active", "trialing", "past_due"]);
  if (error || !primaries?.length) return;

  for (const primary of primaries) {
    if (!primary.session_id || !primary.stripe_subscription_id) continue;

    const [{ data: cart }, { data: siblings }, { data: payment }] = await Promise.all([
      supabaseAdmin
        .from("intake_session_medicines")
        .select("package_id, is_primary")
        .eq("session_id", primary.session_id),
      supabaseAdmin
        .from("subscriptions")
        .select("package_id")
        .eq("checkout_group_id", primary.id)
        .eq("is_checkout_primary", false),
      supabaseAdmin
        .from("payments")
        .select("stripe_invoice_id")
        .eq("stripe_subscription_id", primary.stripe_subscription_id)
        .eq("status", "succeeded")
        .not("stripe_invoice_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const saved = new Set((siblings ?? []).map((row) => row.package_id));
    const missing = (cart ?? []).some(
      (row) => row.is_primary === false && row.package_id && !saved.has(row.package_id),
    );
    if (missing && payment?.stripe_invoice_id) {
      await provisionAddonSubscriptions({
        stripeSubscriptionId: primary.stripe_subscription_id,
        stripeInvoiceId: payment.stripe_invoice_id,
      });
    }

    const { data: addons } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("checkout_group_id", primary.id)
      .eq("is_checkout_primary", false);
    for (const addon of addons ?? []) {
      await ensureOrderForSubscription(addon.stripe_subscription_id);
    }
    await alignPrimaryConsultationFlag(primary.id, primary.session_id);
  }
}

async function ensureOrderForSubscription(stripeSubscriptionId: string | null): Promise<void> {
  if (!stripeSubscriptionId) return;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (!sub?.id) return;

  const { data: existing } = await supabaseAdmin
    .from("medication_requests")
    .select("id")
    .eq("subscription_id", sub.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await coverWithPrimaryConsultation(sub.id);
    return;
  }

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("status", "succeeded")
    .not("stripe_invoice_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!payment?.id) return;
  await ensureMedicationOrderForPayment({ paymentId: payment.id });
  await coverWithPrimaryConsultation(sub.id);
}

async function coverWithPrimaryConsultation(subscriptionId: string): Promise<void> {
  await supabaseAdmin
    .from("medication_requests")
    .update({ requires_consultation: false })
    .eq("subscription_id", subscriptionId)
    .eq("kind", "initial");
}
