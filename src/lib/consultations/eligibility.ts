import "server-only";

import { cache } from "react";

import { loadCheckoutCart } from "@/lib/intake/session-cart";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** True when any medicine in this checkout is marked as needing a consultation. */
export async function sessionRequiresConsultation(
  sessionId: string | null | undefined,
): Promise<boolean> {
  if (!sessionId) return false;
  const cart = await loadCheckoutCart(sessionId);
  return cart.some((line) => line.requiresConsultation);
}

export type ConsultationEligibility = {
  /** Show the Consultations nav when a medicine needs one, or a visit already exists. */
  showNav: boolean;
  needingSubscriptionIds: Set<string>;
  visitSubscriptionIds: Set<string>;
};

type SubscriptionEligibilityRow = {
  id: string;
  checkout_group_id: string | null;
  is_checkout_primary: boolean | null;
  medicines: { requires_consultation: boolean } | { requires_consultation: boolean }[] | null;
};

function medicineRequiresConsultation(row: SubscriptionEligibilityRow): boolean {
  const medicine = row.medicines;
  if (!medicine) return false;
  if (Array.isArray(medicine)) return medicine.some((item) => item.requires_consultation);
  return Boolean(medicine.requires_consultation);
}

/**
 * One checkout offers one consultation, and only when a medicine in that checkout
 * is flagged requires_consultation (or an existing visit should stay reachable).
 */
export const loadConsultationEligibility = cache(
  async (userId: string): Promise<ConsultationEligibility> => {
    const [subsResult, requestsResult, visitsResult] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("id, checkout_group_id, is_checkout_primary, medicines(requires_consultation)")
        .eq("user_id", userId),
      supabaseAdmin
        .from("medication_requests")
        .select("subscription_id, requires_consultation")
        .eq("user_id", userId),
      supabaseAdmin.from("patient_consultations").select("subscription_id").eq("user_id", userId),
    ]);

    if (subsResult.error) throw new Error(subsResult.error.message);
    if (requestsResult.error) throw new Error(requestsResult.error.message);

    const visitRows =
      visitsResult.error && /patient_consultations/i.test(visitsResult.error.message)
        ? []
        : (visitsResult.data ?? []);
    if (visitsResult.error && !/patient_consultations/i.test(visitsResult.error.message)) {
      throw new Error(visitsResult.error.message);
    }

    const subs = (subsResult.data ?? []) as SubscriptionEligibilityRow[];
    const requestNeeds = new Set(
      (requestsResult.data ?? [])
        .filter((row) => row.requires_consultation && row.subscription_id)
        .map((row) => row.subscription_id as string),
    );
    const visitSubs = new Set(
      visitRows.map((row) => row.subscription_id).filter((id): id is string => Boolean(id)),
    );

    const groups = new Map<string, SubscriptionEligibilityRow[]>();
    for (const sub of subs) {
      const key = sub.checkout_group_id ?? sub.id;
      const list = groups.get(key) ?? [];
      list.push(sub);
      groups.set(key, list);
    }

    const needingSubscriptionIds = new Set<string>();
    const visitSubscriptionIds = new Set<string>();
    for (const rows of groups.values()) {
      const needs =
        rows.some((row) => medicineRequiresConsultation(row)) ||
        rows.some((row) => requestNeeds.has(row.id));
      const hasVisit = rows.some((row) => visitSubs.has(row.id));
      if (needs) {
        for (const row of rows) needingSubscriptionIds.add(row.id);
      }
      if (hasVisit) {
        for (const row of rows) visitSubscriptionIds.add(row.id);
      }
    }

    return {
      showNav: needingSubscriptionIds.size > 0 || visitSubscriptionIds.size > 0,
      needingSubscriptionIds,
      visitSubscriptionIds,
    };
  },
);
