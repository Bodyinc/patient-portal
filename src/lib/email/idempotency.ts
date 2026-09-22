import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** email_reminders.target_id is uuid. Stripe invoice ids (in_…) must never be claimed. */
export function isEmailTargetId(targetId: string): boolean {
  return UUID_RE.test(targetId);
}

function rejectNonUuid(reminderType: string, targetId: string): boolean {
  if (isEmailTargetId(targetId)) return false;
  console.error(`[email] refused non-uuid claim ${reminderType}/${targetId}`);
  return true;
}

/** Returns true if this reminder was already recorded (duplicate send should be skipped). */
export async function wasEmailSent(
  reminderType: string,
  targetId: string,
  periodKey = "",
): Promise<boolean> {
  if (rejectNonUuid(reminderType, targetId)) return false;
  const { data } = await supabaseAdmin
    .from("email_reminders")
    .select("target_id")
    .eq("reminder_type", reminderType)
    .eq("target_id", targetId)
    .eq("period_key", periodKey)
    .maybeSingle();
  return Boolean(data);
}

export async function markEmailSent(
  reminderType: string,
  targetId: string,
  periodKey = "",
): Promise<void> {
  if (rejectNonUuid(reminderType, targetId)) return;
  const { error } = await supabaseAdmin.from("email_reminders").insert({
    reminder_type: reminderType,
    target_id: targetId,
    period_key: periodKey,
  });
  if (error && error.code !== "23505") {
    console.error(`[email] failed to record ${reminderType}/${targetId}: ${error.message}`);
  }
}

/**
 * Inserts the reminder row first so concurrent webhook / reconcile / cron callers cannot
 * both pass a read check and send the same mail. Returns false if another caller already claimed it.
 */
export async function claimEmailSend(
  reminderType: string,
  targetId: string,
  periodKey = "",
): Promise<boolean> {
  if (rejectNonUuid(reminderType, targetId)) return false;
  const { error } = await supabaseAdmin.from("email_reminders").insert({
    reminder_type: reminderType,
    target_id: targetId,
    period_key: periodKey,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error(`[email] failed to claim ${reminderType}/${targetId}: ${error.message}`);
  return false;
}

export async function releaseEmailClaim(
  reminderType: string,
  targetId: string,
  periodKey = "",
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("email_reminders")
    .delete()
    .eq("reminder_type", reminderType)
    .eq("target_id", targetId)
    .eq("period_key", periodKey);
  if (error) {
    console.error(`[email] failed to release ${reminderType}/${targetId}: ${error.message}`);
  }
}

/** Claim, send, and release the claim if delivery fails so a later retry can try again. */
export async function sendOnce(
  reminderType: string,
  targetId: string,
  send: () => Promise<boolean>,
  periodKey = "",
): Promise<boolean> {
  if (!(await claimEmailSend(reminderType, targetId, periodKey))) return false;
  try {
    const ok = await send();
    if (!ok) await releaseEmailClaim(reminderType, targetId, periodKey);
    return ok;
  } catch (error) {
    await releaseEmailClaim(reminderType, targetId, periodKey);
    throw error;
  }
}

export async function alreadySentKeys(
  reminderType: string,
  targetIds: string[],
): Promise<Set<string>> {
  const ids = targetIds.filter(isEmailTargetId);
  if (!ids.length) return new Set();
  const { data, error } = await supabaseAdmin
    .from("email_reminders")
    .select("target_id, period_key")
    .eq("reminder_type", reminderType)
    .in("target_id", ids);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => `${r.target_id}|${r.period_key}`));
}
