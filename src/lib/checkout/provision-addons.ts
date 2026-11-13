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

/** First invoice of an add-on is already on the primary checkout, so it is covered once. */
const ADDON_INCLUDED_COUPON_ID = "addon_first_period_included";

function periodEndIso(sub: Stripe.Subscription): string | null {
  const anySub = sub as unknown as {
    current_period_end?: number;
    trial_end?: number | null;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts =
    anySub.current_period_end ??
    anySub.items?.data?.[0]?.current_period_end ??
    anySub.trial_end ??
    null;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function withinOnePricePeriod(anchorUnix: number, price: Stripe.Price): boolean {
  const recurring = price.recurring;
  if (!recurring) return false;
  const count = recurring.interval_count || 1;
  const limit = new Date();
  if (recurring.interval === "month") limit.setUTCMonth(limit.getUTCMonth() + count);
  else if (recurring.interval === "year") limit.setUTCFullYear(limit.getUTCFullYear() + count);
  else if (recurring.interval === "week") limit.setUTCDate(limit.getUTCDate() + 7 * count);
  else limit.setUTCDate(limit.getUTCDate() + count);
  return anchorUnix * 1000 <= limit.getTime() + 24 * 60 * 60 * 1000;
}

async function firstPeriodIncludedCoupon(): Promise<string> {
  try {
    const coupon = await stripe.coupons.retrieve(ADDON_INCLUDED_COUPON_ID);
    if (!coupon.deleted && coupon.percent_off === 100 && coupon.duration === "once") {
      return coupon.id;
    }
  } catch (error) {
    const missing =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "resource_missing";
    if (!missing) throw error;
  }
  const created = await stripe.coupons.create({
    id: ADDON_INCLUDED_COUPON_ID,
    percent_off: 100,
    duration: "once",
    name: "First period already paid",
  });
  return created.id;
}

/**
 * After the primary subscription's first invoice is paid, open an active
 * subscription per add-on. The first period was already charged on the
 * primary invoice, so that invoice is covered and the add-on bills again
 * at renewal — the same active subscription as the primary plan.
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
    .select("id, medicine_id, variant_id, name, stripe_price_id, medicines(name)")
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

    const medicineName =
      (pkg as { medicines?: { name: string } | null }).medicines?.name ?? "Treatment";
    const couponId = await firstPeriodIncludedCoupon();

    const created = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: pkg.stripe_price_id }],
        discounts: [{ coupon: couponId }],
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
          current_period_end: periodEndIso(created),
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
 * An add-on opened with a trial shows "trialing" while the primary plan is "active",
 * even though both were paid on the same checkout. Replace that trial with an active
 * subscription that still bills on the same date.
 */
async function promoteTrialingAddon(stripeSubscriptionId: string): Promise<boolean> {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  if (sub.status !== "trialing" || sub.metadata?.role !== "addon") return false;
  if (sub.metadata.superseded === "1" || sub.metadata.active_promote === "skipped") return false;

  const anchor = sub.trial_end;
  const priceRef = sub.items?.data?.[0]?.price;
  const priceId = typeof priceRef === "string" ? priceRef : (priceRef?.id ?? null);
  if (!anchor || anchor * 1000 < Date.now() + 60_000 || !priceId || !priceRef) return false;
  const price = typeof priceRef === "string" ? await stripe.prices.retrieve(priceRef) : priceRef;
  if (!withinOnePricePeriod(anchor, price)) {
    if (sub.metadata.active_promote !== "skipped") {
      await stripe.subscriptions.update(sub.id, {
        metadata: { ...sub.metadata, active_promote: "skipped" },
      });
    }
    return false;
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return false;
  const defaultPaymentMethodId = paymentMethodId(sub.default_payment_method);
  const description = (sub as Stripe.Subscription & { description?: string | null }).description;

  const created = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      billing_cycle_anchor: anchor,
      proration_behavior: "none",
      ...(defaultPaymentMethodId ? { default_payment_method: defaultPaymentMethodId } : {}),
      ...(description ? { description } : {}),
      metadata: {
        ...sub.metadata,
        role: "addon",
        replaces: sub.id,
        active_promote: "",
        superseded: "",
      },
    },
    { idempotencyKey: `addon-active-${sub.id}` },
  );

  if (created.status !== "active") {
    await stripe.subscriptions
      .cancel(created.id, { invoice_now: false, prorate: false })
      .catch((error) => {
        console.error("[checkout] rollback addon promote failed:", error);
      });
    return false;
  }

  const { error: moveError } = await supabaseAdmin
    .from("subscriptions")
    .update({
      stripe_subscription_id: created.id,
      stripe_price_id: priceId,
      status: created.status,
      current_period_end: periodEndIso(created) ?? new Date(anchor * 1000).toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);

  if (moveError && !/duplicate|unique/i.test(moveError.message)) {
    await stripe.subscriptions
      .cancel(created.id, { invoice_now: false, prorate: false })
      .catch((error) => {
        console.error("[checkout] rollback addon promote failed:", error);
      });
    throw new Error(moveError.message);
  }

  const { data: saved } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", created.id)
    .maybeSingle();
  if (!saved) {
    await stripe.subscriptions
      .cancel(created.id, { invoice_now: false, prorate: false })
      .catch((error) => {
        console.error("[checkout] rollback addon promote failed:", error);
      });
    return false;
  }

  await stripe.subscriptions.update(sub.id, {
    metadata: { ...sub.metadata, superseded: "1" },
  });
  try {
    await stripe.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/canceled|cancelled|no such subscription/i.test(message)) throw error;
  }
  return true;
}

export async function promoteTrialingAddonsForUser(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .eq("is_checkout_primary", false)
    .eq("status", "trialing")
    .not("stripe_subscription_id", "is", null);
  if (error || !data?.length) return;

  for (const row of data) {
    if (!row.stripe_subscription_id) continue;
    try {
      await promoteTrialingAddon(row.stripe_subscription_id);
    } catch (promoteError) {
      console.error("[checkout] promote trialing addon failed:", promoteError);
    }
  }
}

/** Daily pass so an add-on left on a trial becomes active without waiting for a portal visit. */
export async function promoteOpenTrialingAddons(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("is_checkout_primary", false)
    .eq("status", "trialing")
    .not("stripe_subscription_id", "is", null)
    .limit(25);
  if (error || !data?.length) return 0;

  let promoted = 0;
  for (const row of data) {
    if (!row.stripe_subscription_id) continue;
    try {
      if (await promoteTrialingAddon(row.stripe_subscription_id)) promoted += 1;
    } catch (promoteError) {
      console.error("[checkout] promote trialing addon failed:", promoteError);
    }
  }
  return promoted;
}

/**
 * The paid checkout already stored every medicine on the intake session.
 * Open the same subscription + medication request the primary plan gets
 * for any add-on that is still missing.
 */
export async function ensureCheckoutAddons(userId: string): Promise<void> {
  await promoteTrialingAddonsForUser(userId);

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
