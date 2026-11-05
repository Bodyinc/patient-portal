import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

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

function embeddedMedicineName(
  medicines: { name?: string | null } | { name?: string | null }[] | null | undefined,
): string | null {
  const medicine = Array.isArray(medicines) ? medicines[0] : medicines;
  const name = medicine?.name?.trim();
  return name || null;
}

/**
 * Medicines in this purchase.
 * A later shop order can reuse an older intake session so the provider can read
 * the questionnaire. That session's cart is not this order.
 */
export async function orderCoverageLabel(
  subscriptionId: string,
  fallback: string,
): Promise<{ label: string; count: number }> {
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id, checkout_group_id, is_checkout_primary, medicines(name)")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!subscription) return { label: fallback, count: 1 };

  // The filtered sibling query's inferred row omits checkout_group_id, so type
  // rows from the fields this label actually reads.
  let rows: {
    is_checkout_primary: boolean | null;
    medicines: { name: string } | { name: string }[] | null;
  }[] = [subscription];
  if (subscription.checkout_group_id) {
    const { data: siblings } = await supabaseAdmin
      .from("subscriptions")
      .select("id, checkout_group_id, is_checkout_primary, medicines(name)")
      .eq("checkout_group_id", subscription.checkout_group_id);
    if (siblings && siblings.length > 0) rows = siblings;
  }

  const names = [
    ...new Set(
      [...rows]
        .sort(
          (a, b) =>
            (a.is_checkout_primary === false ? 1 : 0) - (b.is_checkout_primary === false ? 1 : 0),
        )
        .map((row) => embeddedMedicineName(row.medicines))
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  if (names.length === 0) return { label: fallback, count: 1 };
  return { label: names.join(", "), count: names.length };
}
