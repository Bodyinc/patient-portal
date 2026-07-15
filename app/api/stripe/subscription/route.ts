import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import { createSubscriptionForPrice } from "@/lib/stripe/subscriptions";
import { resolveCheckoutDiscount, incrementPromoRedemption } from "@/lib/stripe/promos";
import { computeShopOrderFees } from "@/lib/shop/order-fees";
import { getPlatformSettings } from "@/lib/settings/platform-settings";

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
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { medicineId, packageId } = body;
  if (!medicineId || !packageId) {
    return NextResponse.json({ error: "medicineId and packageId are required." }, { status: 400 });
  }

  try {
    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from("packages")
      .select("id, medicine_id, name, price, duration_months, is_active, stripe_price_id")
      .eq("id", packageId)
      .maybeSingle();

    if (pkgError) {
      return NextResponse.json(
        { error: `Could not load plan: ${pkgError.message}` },
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

    const subtotalCents = Math.round(Number(pkg.price) * 100);
    const discount = await resolveCheckoutDiscount({
      code: body.promoCode,
      subtotalCents,
      allowAuto: false,
    });
    const discountCents = discount?.discountCents ?? 0;
    const selectedPlanCode = pkg.duration_months === 1 ? "monthly" : "quarterly";

    const { shippingCents, consultationCents } = await computeShopOrderFees(user.id, medicineId);

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
      throw new Error(orderError?.message ?? "Unable to create order.");
    }

    const customerId = await getOrCreateStripeCustomer({
      userId: user.id,
      email: user.email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    });

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

    const { subscriptionId, clientSecret } = await createSubscriptionForPrice({
      customerId,
      priceId: pkg.stripe_price_id,
      oneTimeFees,
      // Shop orders pay shipping on the first invoice and every renewal.
      recurringShippingCents: shippingCents,
      shippingOnFirstInvoice: true,
      metadata: {
        order_id: order.id,
        user_id: user.id,
        package_id: pkg.id,
        medicine_id: medicineId,
      },
    });

    if (discount) await incrementPromoRedemption(discount.promo.id);

    await supabaseAdmin
      .from("shop_checkout_orders")
      .update({ stripe_subscription_id: subscriptionId })
      .eq("id", order.id);

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        stripe_price_id: pkg.stripe_price_id,
        package_id: pkg.id,
        medicine_id: medicineId,
        status: "incomplete",
      },
      { onConflict: "stripe_subscription_id" },
    );

    return NextResponse.json({ clientSecret, orderId: order.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 },
    );
  }
}
