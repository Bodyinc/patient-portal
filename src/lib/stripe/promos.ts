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
  const { data } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (!data || !isRedeemable(data)) return null;
  return data;
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
  const { data } = await supabaseAdmin
    .from("promo_codes")
    .select("times_redeemed")
    .eq("id", promoId)
    .maybeSingle();
  await supabaseAdmin
    .from("promo_codes")
    .update({ times_redeemed: (data?.times_redeemed ?? 0) + 1 })
    .eq("id", promoId);
}
