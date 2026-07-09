"use server";

import { requireIntakeSession } from "@/lib/intake/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createGuestStripeCustomer } from "@/lib/stripe/customers";
import { createSubscriptionForPrice, ensureNoActiveDuplicate } from "@/lib/stripe/subscriptions";
import { resolveCheckoutDiscount, incrementPromoRedemption } from "@/lib/stripe/promos";
import { CONSULTATION_FEE, PROCESSING_FEE } from "../../../app/onboarding/_lib/onboarding-config";

export type OnboardingSubscriptionResult =
  { ok: true; clientSecret: string } | { ok: false; message: string };

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
    .select("id, medicine_id, is_active, stripe_price_id, duration_months, price")
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

  // DB-driven discount: an entered code, or the admin's auto-apply (welcome) promo.
  const subtotalCents = Math.round(Number(pkg.price) * 100);
  const discount = await resolveCheckoutDiscount({
    code: promoCode,
    subtotalCents,
    allowAuto: true,
  });

  const oneTimeFees: Array<{ amountCents: number; description: string }> = [
    {
      amountCents: Math.round(CONSULTATION_FEE * 100),
      description: "Initial provider consultation",
    },
    { amountCents: Math.round(PROCESSING_FEE * 100), description: "Processing fee" },
  ];
  if (discount) {
    oneTimeFees.push({
      amountCents: -discount.discountCents,
      description: `Discount (${discount.label})`,
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
    oneTimeFees,
    metadata: {
      intake_session_id: session.id,
      package_id: pkg.id,
      medicine_id: pkg.medicine_id,
    },
  });

  if (discount) await incrementPromoRedemption(discount.promo.id);

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

// Client-facing discount preview for the checkout cart. code=null returns the auto-apply
// (welcome) discount when allowAuto is true.
export async function getCheckoutDiscount(input: {
  packageId: string;
  code?: string | null;
  allowAuto: boolean;
}): Promise<{ discountCents: number; label: string } | null> {
  const { data: pkg } = await supabaseAdmin
    .from("packages")
    .select("price")
    .eq("id", input.packageId)
    .maybeSingle();
  if (!pkg) return null;
  const subtotalCents = Math.round(Number(pkg.price) * 100);
  const d = await resolveCheckoutDiscount({
    code: input.code,
    subtotalCents,
    allowAuto: input.allowAuto,
  });
  return d ? { discountCents: d.discountCents, label: d.label } : null;
}
