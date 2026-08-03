"use server";

import { requireIntakeSession } from "@/lib/intake/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createGuestStripeCustomer } from "@/lib/stripe/customers";
import { createSubscriptionForPrice, ensureNoActiveDuplicate } from "@/lib/stripe/subscriptions";
import { resolveCheckoutDiscount } from "@/lib/stripe/promos";
import { getPlatformSettings, effectiveShippingCents } from "@/lib/settings/platform-settings";

export type OnboardingSubscriptionResult =
  { ok: true; clientSecret: string } | { ok: false; message: string };

export async function createOnboardingSubscription(
  promoCode?: string | null,
): Promise<OnboardingSubscriptionResult> {
  const settings = await getPlatformSettings();
  if (settings.maintenance_mode) {
    return {
      ok: false,
      message: "The platform is temporarily unavailable for maintenance. Please try again shortly.",
    };
  }
  if (!settings.new_signups_enabled) {
    return {
      ok: false,
      message: "New patient signups are currently paused. Please check back soon.",
    };
  }

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
    .select(
      "id, medicine_id, variant_id, is_active, stripe_price_id, duration_months, price, medicines(name), medicine_variants(name)",
    )
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

  const oneTimeFees: Array<{ amountCents: number; description: string }> = [];
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

  const medicineName =
    (pkg as { medicines?: { name: string } | null }).medicines?.name ?? "Treatment";
  const variantName =
    (pkg as { medicine_variants?: { name: string } | null }).medicine_variants?.name ?? null;
  const planLabel =
    pkg.duration_months === 1 ? "Monthly Plan" : `${pkg.duration_months}-Month Plan`;

  const { subscriptionId, clientSecret } = await createSubscriptionForPrice({
    customerId,
    priceId: pkg.stripe_price_id,
    description: `${medicineName}${variantName ? ` — ${variantName}` : ""} · ${planLabel}`,
    oneTimeFees,
    // First onboarding invoice is medication-only; shipping recurs from the first renewal.
    recurringShippingCents: effectiveShippingCents(settings),
    shippingOnFirstInvoice: false,
    metadata: {
      intake_session_id: session.id,
      package_id: pkg.id,
      medicine_id: pkg.medicine_id,
      ...(pkg.variant_id ? { variant_id: pkg.variant_id } : {}),
      ...(variantName ? { variant_name: variantName } : {}),
      // Redeemed on invoice.paid — not at form open — so promo recreation doesn't over-count.
      ...(discount ? { promo_id: discount.promo.id, promo_code: discount.label } : {}),
    },
  });

  if (!clientSecret) {
    return { ok: false, message: "Unable to start payment. Please try again." };
  }

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
  /** Optional override when the client already knows the plan price (dollars → cents). */
  subtotalCents?: number;
}): Promise<{ discountCents: number; label: string } | null> {
  let subtotalCents = input.subtotalCents;
  if (subtotalCents == null || !Number.isFinite(subtotalCents) || subtotalCents < 0) {
    const { data: pkg } = await supabaseAdmin
      .from("packages")
      .select("price")
      .eq("id", input.packageId)
      .maybeSingle();
    if (!pkg) return null;
    subtotalCents = Math.round(Number(pkg.price) * 100);
  }

  const d = await resolveCheckoutDiscount({
    code: input.code,
    subtotalCents,
    allowAuto: input.allowAuto,
  });
  return d ? { discountCents: d.discountCents, label: d.label } : null;
}
