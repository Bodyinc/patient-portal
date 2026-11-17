import "server-only";

import { consultationAnchorId } from "@/lib/checkout/group";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPEN_REVIEW_STATUSES = ["payment_completed", "pending_review", "provider_assigned"];

type ShopSub = {
  id: string;
  checkout_group_id: string | null;
  is_checkout_primary: boolean;
  session_id: string | null;
};

/**
 * A shop purchase has no intake session of its own. Onboarding already does,
 * because the questionnaire is finished before payment.
 */
export async function initialShopOrderShouldWait(params: {
  kind: string;
  needsReview: boolean;
  sessionId: string | null;
  stripeSubscriptionId: string | null;
  checkoutGroupId: string | null;
}): Promise<boolean> {
  if (params.kind !== "initial" || !params.needsReview || params.sessionId) return false;
  return isShopCheckout(params.stripeSubscriptionId, params.checkoutGroupId);
}

async function isShopCheckout(
  stripeSubscriptionId: string | null,
  checkoutGroupId: string | null,
): Promise<boolean> {
  if (stripeSubscriptionId) {
    const { data } = await supabaseAdmin
      .from("shop_checkout_orders")
      .select("id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .limit(1)
      .maybeSingle();
    if (data) return true;
  }
  if (!checkoutGroupId) return false;

  const { data: primary } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, session_id")
    .eq("id", checkoutGroupId)
    .maybeSingle();
  if (!primary?.stripe_subscription_id || primary.session_id) return false;

  const { data: shop } = await supabaseAdmin
    .from("shop_checkout_orders")
    .select("id")
    .eq("stripe_subscription_id", primary.stripe_subscription_id)
    .limit(1)
    .maybeSingle();
  return Boolean(shop);
}

function anchorOf(row: ShopSub): string {
  if (row.is_checkout_primary) return row.id;
  return row.checkout_group_id ?? row.id;
}

async function shopFamilyForUser(userId: string): Promise<ShopSub[]> {
  const { data: orders } = await supabaseAdmin
    .from("shop_checkout_orders")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .not("stripe_subscription_id", "is", null);

  const stripeIds = [
    ...new Set(
      (orders ?? [])
        .map((row) => row.stripe_subscription_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (stripeIds.length === 0) return [];

  const { data: primaries } = await supabaseAdmin
    .from("subscriptions")
    .select("id, checkout_group_id, is_checkout_primary, session_id")
    .in("stripe_subscription_id", stripeIds);

  const primaryRows = (primaries ?? []) as ShopSub[];
  if (primaryRows.length === 0) return [];

  const groupIds = [
    ...new Set(
      primaryRows.map((row) => row.checkout_group_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: siblings } =
    groupIds.length > 0
      ? await supabaseAdmin
          .from("subscriptions")
          .select("id, checkout_group_id, is_checkout_primary, session_id")
          .in("checkout_group_id", groupIds)
      : { data: [] as ShopSub[] };

  const byId = new Map<string, ShopSub>();
  for (const row of [...primaryRows, ...((siblings ?? []) as ShopSub[])]) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function submittedAnchorIds(anchorIds: string[]): Promise<Set<string>> {
  if (anchorIds.length === 0) return new Set();
  const first = await supabaseAdmin
    .from("patient_consultations")
    .select("subscription_id, form_submitted, form_submission_id")
    .in("subscription_id", anchorIds);

  let rows = first.data ?? [];
  if (first.error && /form_submitted/i.test(first.error.message)) {
    const retried = await supabaseAdmin
      .from("patient_consultations")
      .select("subscription_id, form_submission_id")
      .in("subscription_id", anchorIds);
    rows = (retried.data ?? []) as typeof rows;
  }

  return new Set(
    rows
      .filter((row) => {
        const submitted =
          "form_submitted" in row
            ? Boolean((row as { form_submitted?: boolean | null }).form_submitted)
            : false;
        return submitted || Boolean(row.form_submission_id);
      })
      .map((row) => row.subscription_id)
      .filter((id): id is string => Boolean(id)),
  );
}

/**
 * Shop purchases that have not submitted the intake form for this order.
 * An older onboarding questionnaire does not count.
 */
export async function shopSubscriptionIdsWithoutOwnIntake(userId: string): Promise<string[]> {
  const family = await shopFamilyForUser(userId);
  if (family.length === 0) return [];

  const submitted = await submittedAnchorIds([...new Set(family.map(anchorOf))]);
  return family.filter((row) => !submitted.has(anchorOf(row))).map((row) => row.id);
}

/**
 * Shop subscriptions whose consultation intake form is not submitted yet,
 * and whose order is still waiting on a provider.
 */
export async function shopSubscriptionIdsAwaitingOwnIntake(userId: string): Promise<string[]> {
  const family = await shopFamilyForUser(userId);
  if (family.length === 0) return [];

  const anchors = [...new Set(family.map(anchorOf))];
  const submitted = await submittedAnchorIds(anchors);
  const waiting = family.filter((row) => !submitted.has(anchorOf(row)));
  if (waiting.length === 0) return [];

  const waitingIds = waiting.map((row) => row.id);
  const { data: requests } = await supabaseAdmin
    .from("medication_requests")
    .select("subscription_id, kind, requires_consultation, status")
    .in("subscription_id", waitingIds)
    .eq("kind", "initial")
    .eq("requires_consultation", true)
    .in("status", OPEN_REVIEW_STATUSES);

  const groups = new Set<string>();
  for (const request of requests ?? []) {
    if (!request.subscription_id) continue;
    const row = waiting.find((item) => item.id === request.subscription_id);
    if (!row) continue;
    groups.add(row.checkout_group_id ?? row.id);
  }

  return waiting.filter((row) => groups.has(row.checkout_group_id ?? row.id)).map((row) => row.id);
}

async function resolveProviderId(params: {
  needsConsultation: boolean;
  userId: string | null;
  sessionId: string | null;
}): Promise<string | null> {
  let state: string | null = null;
  if (params.userId) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("state_code")
      .eq("id", params.userId)
      .maybeSingle();
    state = profile?.state_code ?? null;
  }
  if (!state && params.sessionId) {
    const { data: intake } = await supabaseAdmin
      .from("intake_sessions")
      .select("state_code")
      .eq("id", params.sessionId)
      .maybeSingle();
    state = intake?.state_code ?? null;
  }

  const { data: activeProviders } = await supabaseAdmin
    .from("providers")
    .select("id, license_states, is_default")
    .eq("is_active", true);

  const providers = activeProviders ?? [];
  const defaultId = providers.find((provider) => provider.is_default)?.id ?? null;
  if (!params.needsConsultation) return defaultId;

  if (state) {
    const upper = state.toUpperCase();
    const hasStateProvider = providers.some((provider) =>
      (provider.license_states ?? []).some((code) => code.toUpperCase() === upper),
    );
    if (hasStateProvider) return null;
  }

  return defaultId;
}

/**
 * Keep an unpaid-intake shop order out of the provider claim queue.
 * A provider who already acted on the case is left alone.
 * Returns the subscription ids that must not borrow an older intake yet.
 */
export async function prepareShopOrdersForIntake(userId: string): Promise<string[]> {
  const awaiting = await shopSubscriptionIdsAwaitingOwnIntake(userId);
  if (awaiting.length === 0) return [];

  const { data: requests } = await supabaseAdmin
    .from("medication_requests")
    .select("id, subscription_id, status, provider_id, decision_at, kind")
    .in("subscription_id", awaiting)
    .eq("kind", "initial")
    .in("status", ["pending_review", "payment_completed"])
    .is("decision_at", null);

  const requestIds = (requests ?? []).map((row) => row.id);
  const { data: events } =
    requestIds.length > 0
      ? await supabaseAdmin
          .from("medication_request_events")
          .select("request_id, actor_role")
          .in("request_id", requestIds)
      : { data: [] as { request_id: string; actor_role: string }[] };

  const touched = new Set(
    (events ?? [])
      .filter((event) => event.actor_role && event.actor_role !== "system")
      .map((event) => event.request_id),
  );

  const holdIds = (requests ?? []).filter((row) => !touched.has(row.id)).map((row) => row.id);
  if (holdIds.length === 0) return [];

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("medication_requests")
    .update({
      status: "payment_completed",
      provider_id: null,
      session_id: null,
      updated_at: now,
    })
    .in("id", holdIds)
    .in("status", ["pending_review", "payment_completed"])
    .is("decision_at", null);

  const subscriptionIds = [
    ...new Set(
      (requests ?? [])
        .filter((row) => holdIds.includes(row.id) && row.subscription_id)
        .map((row) => row.subscription_id as string),
    ),
  ];
  if (subscriptionIds.length > 0) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ session_id: null })
      .in("id", subscriptionIds);
  }

  return awaiting;
}

export async function orderIsHeldForShopIntake(requestId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("medication_requests")
    .select("status, kind, requires_consultation, user_id, subscription_id")
    .eq("id", requestId)
    .maybeSingle();
  if (
    !data ||
    data.status !== "payment_completed" ||
    data.kind !== "initial" ||
    !data.requires_consultation ||
    !data.user_id ||
    !data.subscription_id
  ) {
    return false;
  }
  const awaiting = await shopSubscriptionIdsAwaitingOwnIntake(data.user_id);
  return awaiting.includes(data.subscription_id);
}

/**
 * After this purchase's intake form is submitted, open the shop order for
 * provider claim the same way an onboarding order is opened at payment.
 */
export async function releaseShopCheckoutAfterIntake(
  subscriptionId: string,
  options?: { attachIntake?: boolean },
): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, checkout_group_id, is_checkout_primary")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub?.user_id) return;

  const anchorId = await consultationAnchorId(subscriptionId);
  const submitted = await submittedAnchorIds([anchorId, subscriptionId]);
  if (!submitted.has(anchorId) && !submitted.has(subscriptionId)) return;

  if (options?.attachIntake !== false) {
    const { attachExistingIntakeToOpenOrders } = await import("@/lib/intake/attach-intake");
    await attachExistingIntakeToOpenOrders(sub.user_id);
  }

  const groupId = sub.checkout_group_id ?? sub.id;
  const [{ data: self }, { data: grouped }] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("id, session_id").eq("id", groupId),
    supabaseAdmin.from("subscriptions").select("id, session_id").eq("checkout_group_id", groupId),
  ]);
  const members = [...(self ?? []), ...(grouped ?? [])];
  const ids = [...new Set(members.map((row) => row.id))];
  if (!ids.includes(sub.id)) ids.push(sub.id);
  if (ids.length === 0) return;

  const sessionBySub = new Map(members.map((row) => [row.id, row.session_id]));
  const { data: requests } = await supabaseAdmin
    .from("medication_requests")
    .select("id, user_id, subscription_id, payment_id, requires_consultation")
    .in("subscription_id", ids)
    .eq("kind", "initial")
    .eq("status", "payment_completed");

  for (const request of requests ?? []) {
    const providerId = await resolveProviderId({
      needsConsultation: request.requires_consultation,
      userId: request.user_id,
      sessionId: request.subscription_id
        ? (sessionBySub.get(request.subscription_id) ?? null)
        : null,
    });
    const now = new Date().toISOString();
    const { data: updated } = await supabaseAdmin
      .from("medication_requests")
      .update({
        status: "pending_review",
        provider_id: providerId,
        updated_at: now,
      })
      .eq("id", request.id)
      .eq("status", "payment_completed")
      .select("id")
      .maybeSingle();
    if (!updated) continue;

    if (providerId) {
      await supabaseAdmin.from("medication_request_events").insert({
        request_id: request.id,
        status: "provider_assigned",
        actor_role: "system",
      });
    }
    await supabaseAdmin.from("medication_request_events").insert({
      request_id: request.id,
      status: "pending_review",
      actor_role: "system",
    });

    if (request.payment_id) {
      const { sendAdminNewRequestEmail } = await import("@/lib/email/admin-request-email");
      await sendAdminNewRequestEmail(request.payment_id);
    }
  }
}

/** Open shop orders whose intake form is already in, without borrowing another intake first. */
export async function releaseReadyShopOrders(userId: string): Promise<void> {
  const family = await shopFamilyForUser(userId);
  if (family.length === 0) return;

  const anchors = [...new Set(family.map(anchorOf))];
  const submitted = await submittedAnchorIds(anchors);
  const ready = anchors.filter((id) => submitted.has(id));
  for (const anchorId of ready) {
    await releaseShopCheckoutAfterIntake(anchorId, { attachIntake: false });
  }
}
