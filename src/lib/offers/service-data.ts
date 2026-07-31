import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import type { PortalOfferDto } from "./types";

export type { PortalOfferDto } from "./types";

type OfferRow = {
  headline: string;
  badge_text: string | null;
  cta_label: string;
  cta_href: string;
  promo_code_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  promo_codes?: {
    code: string;
    is_active: boolean;
    redeem_by: string | null;
    max_redemptions: number | null;
    times_redeemed: number;
  } | null;
};

function isPromoDisplayable(
  promo: NonNullable<OfferRow["promo_codes"]> | null | undefined,
): boolean {
  if (!promo) return true;
  if (!promo.is_active) return false;
  if (promo.redeem_by && new Date(promo.redeem_by) <= new Date()) return false;
  if (promo.max_redemptions != null && (promo.times_redeemed ?? 0) >= promo.max_redemptions) {
    return false;
  }
  return true;
}

/** Offer is shown from starts_at through the end of the ends_at calendar day (UTC). */
function isWithinOfferWindow(
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number,
): boolean {
  if (startsAt && new Date(startsAt).getTime() > nowMs) return false;
  if (endsAt) {
    const end = new Date(endsAt);
    const endOfDayMs = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      23,
      59,
      59,
      999,
    );
    if (endOfDayMs < nowMs) return false;
  }
  return true;
}

/** Active marketing offer for the portal banner, or null when none should show. */
export async function fetchActivePortalOffer(): Promise<PortalOfferDto | null> {
  const { data, error } = await supabaseAdmin
    .from("portal_offers")
    .select(
      "headline, badge_text, cta_label, cta_href, promo_code_id, starts_at, ends_at, promo_codes(code, is_active, redeem_by, max_redemptions, times_redeemed)",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[portal_offers] fetch failed:", error.message);
    throw new Error(error.message);
  }

  const nowMs = Date.now();
  const rows = (data ?? []) as OfferRow[];

  const row = rows.find((candidate) => {
    if (!isWithinOfferWindow(candidate.starts_at, candidate.ends_at, nowMs)) return false;
    return isPromoDisplayable(candidate.promo_codes ?? null);
  });
  if (!row) return null;

  const headline = row.headline.trim();
  if (!headline) return null;

  return {
    headline,
    couponCode: row.promo_codes?.code?.trim() || null,
    badgeText: row.badge_text?.trim() || null,
    ctaLabel: row.cta_label.trim() || "View Treatment Details",
    ctaHref: row.cta_href.trim() || "/shop",
  };
}
