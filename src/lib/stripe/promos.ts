import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type PromoCodeRow = Database["public"]["Tables"]["promo_codes"]["Row"];

function isRedeemable(promo: PromoCodeRow): boolean {
  if (!promo.is_active) return false;
  if (promo.redeem_by && new Date(promo.redeem_by) <= new Date()) return false;
  if (promo.max_redemptions != null && (promo.times_redeemed ?? 0) >= promo.max_redemptions) {
    return false;
  }
  return true;
}

export async function resolvePromoByCode(
  code: string | null | undefined,
): Promise<PromoCodeRow | null> {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  // Exact match first (codes are normally stored uppercase).
  const { data: exact } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (exact && isRedeemable(exact)) return exact;

  // Case-insensitive fallback for codes stored with mixed casing in admin.
  const { data: rows } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .ilike("code", normalized)
    .limit(5);
  const match = (rows ?? []).find(
    (row) => row.code.trim().toUpperCase() === normalized && isRedeemable(row),
  );
  return match ?? null;
}

export async function resolveAutoApplyPromo(): Promise<PromoCodeRow | null> {
  const { data } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("auto_apply", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || !isRedeemable(data)) return null;
  return data;
}

export function computePromoDiscountCents(promo: PromoCodeRow, subtotalCents: number): number {
  if (promo.discount_type === "percent" && promo.percent_off != null) {
    return Math.min(subtotalCents, Math.round((subtotalCents * Number(promo.percent_off)) / 100));
  }
  if (promo.discount_type === "amount" && promo.amount_off_cents != null) {
    return Math.min(subtotalCents, promo.amount_off_cents);
  }
  return 0;
}

export type ResolvedDiscount = { promo: PromoCodeRow; discountCents: number; label: string };

// A patient-entered code takes precedence; otherwise the auto-apply (welcome) promo when allowed
// (onboarding first-time checkouts). Returns null when nothing applies.
export async function resolveCheckoutDiscount(opts: {
  code?: string | null;
  subtotalCents: number;
  allowAuto: boolean;
}): Promise<ResolvedDiscount | null> {
  const entered = await resolvePromoByCode(opts.code);
  const promo = entered ?? (opts.allowAuto ? await resolveAutoApplyPromo() : null);
  if (!promo) return null;
  const discountCents = computePromoDiscountCents(promo, opts.subtotalCents);
  if (discountCents <= 0) return null;
  return { promo, discountCents, label: promo.code };
}

export async function incrementPromoRedemption(promoId: string): Promise<void> {
  // Atomic increment (see migration 20260720120000_promo_atomic_increment) so concurrent
  // redemptions can't lose an update and over-redeem a capped code.
  const { error } = await supabaseAdmin.rpc(
    "increment_promo_redemption" as never,
    {
      p_promo_id: promoId,
    } as never,
  );
  if (error) {
    console.error("[promos] redemption increment failed:", error.message);
  }
}

/**
 * Checkout used to apply promos only as a negative invoice line. The page showed $0 while
 * Stripe still opened a PaymentIntent for the full plan (bank OTP for $181 with 100OFF).
 * Attach a real Stripe promotion code so the first invoice amount_due matches the cart.
 */
export async function ensureStripePromotionCode(promo: PromoCodeRow): Promise<string> {
  const { stripe } = await import("./server");

  if (promo.stripe_promotion_code_id) {
    try {
      const existing = await stripe.promotionCodes.retrieve(promo.stripe_promotion_code_id);
      if (existing.active) return existing.id;
    } catch {
      // Recreate below when the saved id is missing from this Stripe account.
    }
  }

  async function rememberPromotionCode(promotionCodeId: string, couponId: string) {
    await supabaseAdmin
      .from("promo_codes")
      .update({
        stripe_promotion_code_id: promotionCodeId,
        stripe_coupon_id: couponId,
      })
      .eq("id", promo.id);
    return promotionCodeId;
  }

  const listed = await stripe.promotionCodes.list({
    code: promo.code,
    limit: 1,
  });
  const found = listed.data[0];
  if (found?.active) {
    const couponRef = found.promotion?.coupon;
    const couponId = typeof couponRef === "string" ? couponRef : couponRef?.id;
    if (!couponId) throw new Error("Stripe promotion code is missing its coupon.");
    return rememberPromotionCode(found.id, couponId);
  }

  let couponId = promo.stripe_coupon_id;
  if (couponId) {
    try {
      await stripe.coupons.retrieve(couponId);
    } catch {
      couponId = null;
    }
  }

  if (!couponId) {
    const duration =
      promo.duration === "repeating" || promo.duration === "forever" ? promo.duration : "once";
    const coupon = await stripe.coupons.create({
      name: promo.code,
      duration,
      ...(duration === "repeating" && promo.duration_in_months
        ? { duration_in_months: promo.duration_in_months }
        : {}),
      ...(promo.discount_type === "percent"
        ? { percent_off: Number(promo.percent_off ?? 0) }
        : {
            amount_off: Number(promo.amount_off_cents ?? 0),
            currency: (promo.currency || "usd").toLowerCase(),
          }),
    });
    couponId = coupon.id;
  }

  try {
    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: couponId },
      code: promo.code,
      ...(promo.max_redemptions != null ? { max_redemptions: promo.max_redemptions } : {}),
      ...(promo.redeem_by
        ? { expires_at: Math.floor(new Date(promo.redeem_by).getTime() / 1000) }
        : {}),
    });
    return rememberPromotionCode(promotionCode.id, couponId);
  } catch (error) {
    // Another checkout may have created the same code; reuse it.
    const again = await stripe.promotionCodes.list({ code: promo.code, limit: 1 });
    const existing = again.data[0];
    if (existing?.active) {
      const couponRef = existing.promotion?.coupon;
      const existingCoupon = typeof couponRef === "string" ? couponRef : couponRef?.id;
      if (!existingCoupon) throw error;
      return rememberPromotionCode(existing.id, existingCoupon);
    }
    throw error;
  }
}
