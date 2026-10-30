import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Latest intake session for this patient that already has questionnaire answers.
 * Shop orders do not create an intake session, so the provider shows "Missing"
 * until the completed onboarding intake is attached to the order.
 */
export async function findCompletedIntakeSessionId(userId: string): Promise<string | null> {
  const [{ data: subs }, { data: claimed }, { data: requests }] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("session_id")
      .eq("user_id", userId)
      .not("session_id", "is", null),
    supabaseAdmin
      .from("intake_sessions")
      .select("id")
      .eq("claimed_by_user_id", userId)
      .eq("status", "completed"),
    supabaseAdmin
      .from("medication_requests")
      .select("session_id")
      .eq("user_id", userId)
      .not("session_id", "is", null),
  ]);

  const ids = [
    ...new Set(
      [
        ...(subs ?? []).map((row) => row.session_id),
        ...(claimed ?? []).map((row) => row.id),
        ...(requests ?? []).map((row) => row.session_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return null;

  const { data: answers } = await supabaseAdmin
    .from("intake_session_questionnaire_responses")
    .select("session_id, created_at")
    .in("session_id", ids)
    .order("created_at", { ascending: false });

  return answers?.[0]?.session_id ?? null;
}

/** Copy a completed intake onto paid orders that were placed without one. */
export async function attachExistingIntakeToOpenOrders(userId: string): Promise<string | null> {
  const sessionId = await findCompletedIntakeSessionId(userId);
  if (!sessionId) return null;

  const now = new Date().toISOString();
  await Promise.all([
    supabaseAdmin
      .from("medication_requests")
      .update({ session_id: sessionId, updated_at: now })
      .eq("user_id", userId)
      .is("session_id", null),
    supabaseAdmin
      .from("subscriptions")
      .update({ session_id: sessionId })
      .eq("user_id", userId)
      .is("session_id", null)
      .in("status", ["active", "trialing"]),
  ]);

  return sessionId;
}
