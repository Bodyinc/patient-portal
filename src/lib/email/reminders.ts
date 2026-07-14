import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "./send";
import { incompleteOrderEmail, refillReminderEmail } from "./reminder-emails";

const INCOMPLETE_ORDER_DELAY_HOURS = 24;
const REFILL_WINDOW_DAYS = 5;
const ACTIVE_INTAKE_STATUSES = ["in_progress", "payment_pending"] as const;

export type ReminderRunResult = { candidates: number; sent: number };

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    console.warn("[reminders] NEXT_PUBLIC_APP_URL not set — email links will use localhost");
    return "http://localhost:3000";
  }
  return url.replace(/\/$/, "");
}

async function alreadySentKeys(reminderType: string, targetIds: string[]): Promise<Set<string>> {
  if (!targetIds.length) return new Set();
  const { data, error } = await supabaseAdmin
    .from("email_reminders")
    .select("target_id, period_key")
    .eq("reminder_type", reminderType)
    .in("target_id", targetIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => `${r.target_id}|${r.period_key}`));
}

async function markSent(reminderType: string, targetId: string, periodKey: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("email_reminders")
    .insert({ reminder_type: reminderType, target_id: targetId, period_key: periodKey });
  if (error && error.code !== "23505") {
    console.error(`[reminders] failed to record ${reminderType}/${targetId}: ${error.message}`);
  }
}

export async function sendIncompleteOrderReminders(now = new Date()): Promise<ReminderRunResult> {
  const staleBefore = new Date(now.getTime() - INCOMPLETE_ORDER_DELAY_HOURS * 60 * 60 * 1000);

  const { data: sessions, error } = await supabaseAdmin
    .from("intake_sessions")
    .select("id, session_token, email, full_name, selected_plan_id, updated_at")
    .in("status", [...ACTIVE_INTAKE_STATUSES])
    .not("email", "is", null)
    .gt("expires_at", now.toISOString())
    .lt("updated_at", staleBefore.toISOString());
  if (error) throw new Error(error.message);

  const candidates = sessions ?? [];
  const sentKeys = await alreadySentKeys(
    "incomplete_order",
    candidates.map((s) => s.id),
  );

  const planIds = [
    ...new Set(candidates.map((s) => s.selected_plan_id).filter(Boolean)),
  ] as string[];
  const { data: plans } = planIds.length
    ? await supabaseAdmin.from("packages").select("id, name").in("id", planIds)
    : { data: [] };
  const planNameById = new Map((plans ?? []).map((p) => [p.id, p.name]));

  let sent = 0;
  for (const session of candidates) {
    if (!session.email || sentKeys.has(`${session.id}|`)) continue;

    const { subject, html } = incompleteOrderEmail({
      fullName: session.full_name,
      planName: session.selected_plan_id
        ? (planNameById.get(session.selected_plan_id) ?? null)
        : null,
      resumeUrl: `${appUrl()}/onboarding/resume?token=${encodeURIComponent(session.session_token)}`,
    });

    if (await sendTransactionalEmail({ to: session.email, subject, html })) {
      await markSent("incomplete_order", session.id, "");
      sent += 1;
    }
  }

  return { candidates: candidates.length, sent };
}

export async function sendRefillReminders(now = new Date()): Promise<ReminderRunResult> {
  const windowEnd = new Date(now.getTime() + REFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data: subs, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, medicine_id, package_id, current_period_end")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .not("user_id", "is", null)
    .not("current_period_end", "is", null)
    .gt("current_period_end", now.toISOString())
    .lt("current_period_end", windowEnd.toISOString());
  if (error) throw new Error(error.message);

  const candidates = subs ?? [];
  const sentKeys = await alreadySentKeys(
    "refill",
    candidates.map((s) => s.id),
  );

  const userIds = [...new Set(candidates.map((s) => s.user_id).filter(Boolean))] as string[];
  const medicineIds = [
    ...new Set(candidates.map((s) => s.medicine_id).filter(Boolean)),
  ] as string[];
  const packageIds = [...new Set(candidates.map((s) => s.package_id).filter(Boolean))] as string[];

  const [{ data: profiles }, { data: medicines }, { data: packages }] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    medicineIds.length
      ? supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
      : Promise.resolve({ data: [] }),
    packageIds.length
      ? supabaseAdmin.from("packages").select("id, price").in("id", packageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const medicineById = new Map((medicines ?? []).map((m) => [m.id, m]));
  const packageById = new Map((packages ?? []).map((p) => [p.id, p]));

  let sent = 0;
  for (const sub of candidates) {
    const periodKey = sub.current_period_end ?? "";
    if (sentKeys.has(`${sub.id}|${periodKey}`)) continue;

    const profile = sub.user_id ? profileById.get(sub.user_id) : undefined;
    if (!profile?.email) continue;

    const pkg = sub.package_id ? packageById.get(sub.package_id) : undefined;
    const { subject, html } = refillReminderEmail({
      fullName: profile.full_name,
      medicineName:
        (sub.medicine_id ? medicineById.get(sub.medicine_id)?.name : null) ??
        "Treatment Subscription",
      renewalDate: sub.current_period_end as string,
      amountCents: pkg?.price != null ? Math.round(Number(pkg.price) * 100) : null,
      billingUrl: `${appUrl()}/billing`,
    });

    if (await sendTransactionalEmail({ to: profile.email, subject, html })) {
      await markSent("refill", sub.id, periodKey);
      sent += 1;
    }
  }

  return { candidates: candidates.length, sent };
}
