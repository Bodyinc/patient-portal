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
};

type PromoRow = {
  code: string;
  is_active: boolean;
  redeem_by: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
};

function isPromoDisplayable(promo: PromoRow): boolean {
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
  // Avoid embedding promo_codes here — a join failure previously wiped the whole banner.
  const { data, error } = await supabaseAdmin
    .from("portal_offers")
    .select("headline, badge_text, cta_label, cta_href, promo_code_id, starts_at, ends_at")
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

  if (rows.length === 0) {
    console.info("[portal_offers] no active rows (is_active = true)");
    return null;
  }

  const row = rows.find((candidate) =>
    isWithinOfferWindow(candidate.starts_at, candidate.ends_at, nowMs),
  );

  if (!row) {
    console.info("[portal_offers] active rows exist but none are in date window", {
      now: new Date(nowMs).toISOString(),
      candidates: rows.map((r) => ({
        headline: r.headline,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
      })),
    });
    return null;
  }

  const headline = row.headline.trim();
  if (!headline) return null;

  let couponCode: string | null = null;
  if (row.promo_code_id) {
    const { data: promo, error: promoError } = await supabaseAdmin
      .from("promo_codes")
      .select("code, is_active, redeem_by, max_redemptions, times_redeemed")
      .eq("id", row.promo_code_id)
      .maybeSingle();

    if (promoError) {
      console.error("[portal_offers] promo lookup failed:", promoError.message);
    } else if (promo && isPromoDisplayable(promo as PromoRow)) {
      couponCode = promo.code?.trim() || null;
    }
  }

  return {
    headline,
    couponCode,
    badgeText: row.badge_text?.trim() || null,
    ctaLabel: row.cta_label.trim() || "View Treatment Details",
    ctaHref: row.cta_href.trim() || "/shop",
  };
}
