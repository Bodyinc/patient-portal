import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/** Returns true if this reminder was already recorded (duplicate send should be skipped). */
export async function wasEmailSent(
  reminderType: string,
  targetId: string,
  periodKey = "",
): Promise<boolean> {
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
  const { error } = await supabaseAdmin.from("email_reminders").insert({
    reminder_type: reminderType,
    target_id: targetId,
    period_key: periodKey,
  });
  if (error && error.code !== "23505") {
    console.error(`[email] failed to record ${reminderType}/${targetId}: ${error.message}`);
  }
}

export async function alreadySentKeys(
  reminderType: string,
  targetIds: string[],
): Promise<Set<string>> {
  if (!targetIds.length) return new Set();
  const { data, error } = await supabaseAdmin
    .from("email_reminders")
    .select("target_id, period_key")
    .eq("reminder_type", reminderType)
    .in("target_id", targetIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => `${r.target_id}|${r.period_key}`));
}
