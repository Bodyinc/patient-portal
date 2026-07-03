import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type PromoCodeRow = Database["public"]["Tables"]["promo_codes"]["Row"];

export async function resolveActivePromo(
  code: string | null | undefined,
): Promise<PromoCodeRow | null> {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const { data } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("code", normalized)
    .eq("is_active", true)
    .maybeSingle();

  if (!data || !data.stripe_promotion_code_id) return null;
  return data;
}

export function computePromoDiscountCents(promo: PromoCodeRow, subtotalCents: number): number {
  if (promo.discount_type === "percent" && promo.percent_off != null) {
    return Math.round((subtotalCents * promo.percent_off) / 100);
  }
  if (promo.discount_type === "amount" && promo.amount_off_cents != null) {
    return Math.min(subtotalCents, promo.amount_off_cents);
  }
  return 0;
}
