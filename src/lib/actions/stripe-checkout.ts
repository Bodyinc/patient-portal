"use server";

import { requireIntakeSession } from "@/lib/intake/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createGuestStripeCustomer } from "@/lib/stripe/customers";
import { createSubscriptionForPrice, ensureNoActiveDuplicate } from "@/lib/stripe/subscriptions";
import { resolveActivePromo } from "@/lib/stripe/promos";
import { CONSULTATION_FEE, PROCESSING_FEE } from "../../../app/onboarding/_lib/onboarding-config";
import { resolvePromoDiscount } from "../../../app/onboarding/_lib/intake-pricing";

export type OnboardingSubscriptionResult =
  | { ok: true; clientSecret: string }
  | { ok: false; message: string };

export async function createOnboardingSubscription(
  promoCode?: string | null,
): Promise<OnboardingSubscriptionResult> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, message: sessionResult.error };
  }

  const session = sessionResult.session;
  if (!session.email) {
    return { ok: false, message: "Add your email before checkout." };
  }
  if (!session.selected_plan_id) {
    return { ok: false, message: "Select a treatment plan first." };
  }

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from("packages")
    .select("id, medicine_id, is_active, stripe_price_id, duration_months")
    .eq("id", session.selected_plan_id)
    .maybeSingle();

  if (pkgError) {
    return { ok: false, message: `Could not load plan: ${pkgError.message}` };
  }
  if (!pkg) {
    return { ok: false, message: "Selected plan was not found." };
  }
  if (!pkg.is_active) {
    return { ok: false, message: "Selected plan is inactive." };
  }
  if (!pkg.stripe_price_id) {
    return { ok: false, message: "This plan is not available for purchase yet." };
  }

  // Void any prior incomplete subscription for this session so the fresh one reflects
  // current pricing/fees; block if it was already paid.
  if (session.stripe_subscription_id) {
    const { alreadyPaid } = await ensureNoActiveDuplicate(session.stripe_subscription_id);
    if (alreadyPaid) {
      return { ok: false, message: "This plan has already been purchased." };
    }
  }

  const promo = await resolveActivePromo(promoCode);
  // A DB-backed promo (Phase 5) wins via a Stripe coupon; otherwise mirror the cart's
  // current discount logic as a negative line item so the charge matches "Total Due Today".
  const { discount, label } = promo
    ? { discount: 0, label: null as string | null }
    : resolvePromoDiscount(promoCode, pkg.duration_months);

  const oneTimeFees: Array<{ amountCents: number; description: string }> = [
    {
      amountCents: Math.round(CONSULTATION_FEE * 100),
      description: "Initial provider consultation",
    },
    { amountCents: Math.round(PROCESSING_FEE * 100), description: "Processing fee" },
  ];
  if (discount > 0) {
    oneTimeFees.push({
      amountCents: -Math.round(discount * 100),
      description: label ? `Discount (${label})` : "Discount",
    });
  }

  const customerId =
    session.stripe_customer_id ??
    (await createGuestStripeCustomer({
      email: session.email,
      name: session.full_name,
      intakeSessionId: session.id,
    }));

  const { subscriptionId, clientSecret } = await createSubscriptionForPrice({
    customerId,
    priceId: pkg.stripe_price_id,
    promotionCodeId: promo?.stripe_promotion_code_id ?? null,
    oneTimeFees,
    metadata: {
      intake_session_id: session.id,
      package_id: pkg.id,
      medicine_id: pkg.medicine_id,
    },
  });

  await supabaseAdmin
    .from("intake_sessions")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: "payment_pending",
    })
    .eq("id", session.id);

  await supabaseAdmin.from("subscriptions").upsert(
    {
      session_id: session.id,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      stripe_price_id: pkg.stripe_price_id,
      package_id: pkg.id,
      medicine_id: pkg.medicine_id,
      status: "incomplete",
    },
    { onConflict: "stripe_subscription_id" },
  );

  return { ok: true, clientSecret };
}
