import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/** Patients may request a manual refill starting this long before the plan ends. */
const REFILL_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export function canRequestManualRefill(params: {
  /** Stripe will charge the next period without a new checkout. */
  autoPay: boolean;
  orderStatus: string | null;
  tenureEndsAt: string | null;
  now?: Date;
}): boolean {
  if (params.autoPay) return false;
  if (params.orderStatus !== "delivered") return false;
  if (!params.tenureEndsAt) return false;
  const end = new Date(params.tenureEndsAt).getTime();
  if (Number.isNaN(end)) return false;
  const now = params.now ?? new Date();
  return now.getTime() >= end - REFILL_LEAD_MS;
}

/**
 * Null when checkout may proceed: either this is a first purchase, or a manual refill is open.
 * A message when an active plan for this medicine is not ready for a refill request.
 */
export async function getManualRefillBlock(
  userId: string,
  medicineId: string,
  now = new Date(),
): Promise<string | null> {
  const { data: subs, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .eq("medicine_id", medicineId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const sub = subs?.[0];
  if (!sub) return null;

  const { data: request, error: requestError } = await supabaseAdmin
    .from("medication_requests")
    .select("status")
    .eq("user_id", userId)
    .eq("subscription_id", sub.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) throw new Error(requestError.message);

  const autoPay = !sub.cancel_at_period_end;
  const orderStatus = request?.status ?? null;
  const tenureEndsAt = sub.current_period_end;
  if (canRequestManualRefill({ autoPay, orderStatus, tenureEndsAt, now })) return null;

  if (autoPay) {
    return "This treatment renews automatically, so a refill request isn't needed.";
  }
  if (orderStatus !== "delivered") {
    return "You can request a refill after this order is delivered.";
  }
  return "You can request a refill one week before your plan ends.";
}
