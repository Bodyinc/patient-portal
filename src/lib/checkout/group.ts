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

/** First invoice of an add-on subscription. That charge is already on the primary invoice. */
export async function isInitialAddonSubscription(
  stripeSubscriptionId: string | null,
): Promise<boolean> {
  if (!stripeSubscriptionId) return false;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, is_checkout_primary")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (!sub || sub.is_checkout_primary !== false) return false;

  const { data: prior } = await supabaseAdmin
    .from("medication_requests")
    .select("id")
    .eq("subscription_id", sub.id)
    .eq("kind", "followup")
    .limit(1)
    .maybeSingle();
  return !prior;
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
