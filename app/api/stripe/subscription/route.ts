import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import { formatSavedCardLabel, getDefaultPaymentMethod } from "@/lib/stripe/payment-methods";
import { createSubscriptionForPrice } from "@/lib/stripe/subscriptions";
import { resolveCheckoutDiscount, incrementPromoRedemption } from "@/lib/stripe/promos";
import { getManualRefillBlock } from "@/lib/orders/refill-eligibility";
import { missingOrderDetailsMessage } from "@/lib/profile/shipping-address";
import { computeShopOrderFees } from "@/lib/shop/order-fees";
import { getPlatformSettings } from "@/lib/settings/platform-settings";
import { userFacingMessage } from "@/lib/user-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  medicineId?: string;
  packageId?: string;
  promoCode?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  if ((await getPlatformSettings()).maintenance_mode) {
    return NextResponse.json(
      {
        error: "The platform is temporarily unavailable for maintenance. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please refresh and try again." },
      { status: 400 },
    );
  }

  const { medicineId, packageId } = body;
  if (!medicineId || !packageId) {
    return NextResponse.json({ error: "Select a plan before continuing." }, { status: 400 });
  }

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, state_code, street_address, city, postal_code")
      .eq("id", user.id)
      .maybeSingle();
    const missingDetails = missingOrderDetailsMessage(
      {
        fullName: profile?.full_name,
        phone: profile?.phone,
        stateCode: profile?.state_code,
        streetAddress: profile?.street_address,
        city: profile?.city,
        postalCode: profile?.postal_code,
      },
      "profile",
    );
    if (missingDetails) {
      return NextResponse.json({ error: missingDetails }, { status: 400 });
    }

    // These three reads are independent — package details, order fees, and the Stripe customer
    // all only depend on inputs we already have, so fetch them in one parallel wave.
    const [{ data: pkg, error: pkgError }, fees, customerId] = await Promise.all([
      supabaseAdmin
        .from("packages")
        .select(
          "id, medicine_id, variant_id, name, price, duration_months, is_active, stripe_price_id, medicines(name), medicine_variants(name)",
        )
        .eq("id", packageId)
        .maybeSingle(),
      computeShopOrderFees(user.id, medicineId),
      getPatientDisplayIdentity(user.id).then((identity) =>
        getOrCreateStripeCustomer({
          userId: user.id,
          email: user.email ?? null,
          name: identity.stripeName,
        }),
      ),
    ]);

    if (pkgError) {
      return NextResponse.json(
        {
          error: userFacingMessage(
            pkgError.message,
            "We couldn't load that plan. Please try again.",
          ),
        },
        { status: 500 },
      );
    }
    if (!pkg || !pkg.is_active || pkg.medicine_id !== medicineId) {
      return NextResponse.json({ error: "Selected plan is not valid." }, { status: 400 });
    }
    if (!pkg.stripe_price_id) {
      return NextResponse.json(
        { error: "This plan is not available for purchase yet." },
        { status: 400 },
      );
    }

    const refillBlock = await getManualRefillBlock(user.id, medicineId);
    if (refillBlock) {
      return NextResponse.json({ error: refillBlock }, { status: 400 });
    }

    const { shippingCents, consultationCents } = fees;

    const medicineName =
      (pkg as { medicines?: { name: string } | null }).medicines?.name ?? "Treatment";
    const variantName =
      (pkg as { medicine_variants?: { name: string } | null }).medicine_variants?.name ?? null;
    const planLabel =
      pkg.duration_months === 1 ? "Monthly Plan" : `${pkg.duration_months}-Month Plan`;
    const subscriptionDescription = `${medicineName}${variantName ? ` — ${variantName}` : ""} · ${planLabel}`;

    const subtotalCents = Math.round(Number(pkg.price) * 100);
    const selectedPlanCode = pkg.duration_months === 1 ? "monthly" : "quarterly";

    // Discount needs the plan subtotal; the saved card needs the customer — both are ready now.
    const [discount, savedPaymentMethod] = await Promise.all([
      resolveCheckoutDiscount({ code: body.promoCode, subtotalCents, allowAuto: false }),
      getDefaultPaymentMethod(customerId),
    ]);
    const discountCents = discount?.discountCents ?? 0;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("shop_checkout_orders")
      .insert({
        user_id: user.id,
        medicine_id: medicineId,
        selected_package_id: pkg.id,
        selected_plan_code: selectedPlanCode,
        payment_method_code: "card",
        promo_code: discount?.label ?? null,
        promo_savings: discountCents / 100,
        subtotal: subtotalCents / 100,
        shipping: shippingCents / 100,
        consultation: consultationCents / 100,
        total: (subtotalCents - discountCents + shippingCents + consultationCents) / 100,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      throw new Error(
        userFacingMessage(orderError?.message, "We couldn't start your order. Please try again."),
      );
    }

    // Consultation is one-time; shipping is a recurring subscription item (below) so it is
    // NOT added here as a one-time fee.
    const oneTimeFees: Array<{ amountCents: number; description: string }> = [];
    if (consultationCents > 0) {
      oneTimeFees.push({ amountCents: consultationCents, description: "Consultation fee" });
    }
    if (discount) {
      oneTimeFees.push({
        amountCents: -discountCents,
        description: `Discount (${discount.label})`,
      });
    }

    const { subscriptionId, clientSecret, paid } = await createSubscriptionForPrice({
      customerId,
      priceId: pkg.stripe_price_id,
      description: subscriptionDescription,
      oneTimeFees,
      // Shop orders pay shipping on the first invoice and every renewal.
      recurringShippingCents: shippingCents,
      shippingOnFirstInvoice: true,
      defaultPaymentMethodId: savedPaymentMethod?.id ?? null,
      metadata: {
        order_id: order.id,
        user_id: user.id,
        package_id: pkg.id,
        medicine_id: medicineId,
        ...(pkg.variant_id ? { variant_id: pkg.variant_id } : {}),
        ...(variantName ? { variant_name: variantName } : {}),
      },
    });

    // These three writes are independent of each other — run them together.
    await Promise.all([
      discount ? incrementPromoRedemption(discount.promo.id) : Promise.resolve(),
      supabaseAdmin
        .from("shop_checkout_orders")
        .update({
          stripe_subscription_id: subscriptionId,
          ...(paid ? { status: "paid" } : {}),
        })
        .eq("id", order.id),
      supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          stripe_price_id: pkg.stripe_price_id,
          package_id: pkg.id,
          medicine_id: medicineId,
          status: paid ? "active" : "incomplete",
        },
        { onConflict: "stripe_subscription_id" },
      ),
    ]);

    return NextResponse.json(
      {
        orderId: order.id,
        clientSecret: clientSecret ?? null,
        paid,
        savedCardLabel: savedPaymentMethod ? formatSavedCardLabel(savedPaymentMethod) : null,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: userFacingMessage(error, "Unable to start checkout. Please try again.") },
      { status: 500 },
    );
  }
}
