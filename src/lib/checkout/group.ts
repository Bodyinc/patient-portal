import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import { loadCheckoutCart } from "@/lib/intake/session-cart";

/** Subscription that owns the single consultation for this checkout. */
export async function consultationAnchorId(subscriptionId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, is_checkout_primary, checkout_group_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error || !data) return subscriptionId;
  if (data.is_checkout_primary !== false || !data.checkout_group_id) return subscriptionId;

  const { data: primary } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("checkout_group_id", data.checkout_group_id)
    .eq("is_checkout_primary", true)
    .limit(1)
    .maybeSingle();

  return primary?.id ?? subscriptionId;
}

/**
 * Label for every product in the intake checkout.
 * A single product keeps the caller-supplied medicine name.
 */
export async function checkoutCoverageLabel(
  sessionId: string | null | undefined,
  fallback: string,
): Promise<{ label: string; count: number }> {
  if (!sessionId) return { label: fallback, count: 1 };

  const cart = await loadCheckoutCart(sessionId);
  if (cart.length <= 1) return { label: fallback, count: cart.length || 1 };

  const label = cart.map((line) => `${line.medicineName} (${line.categoryName})`).join(", ");
  return { label, count: cart.length };
}
