import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendOnce } from "./idempotency";
import { patientInquiryUpdateEmail } from "./feedback-email";
import { appUrl } from "./recipients";
import { sendTransactionalEmail } from "./send";

const INQUIRY_UPDATE_CLAIM = "patient_inquiry_update";
const LOOKBACK_HOURS = 72;

export type ReminderRunResult = { candidates: number; sent: number };

/**
 * Backup send for admin inquiry replies. Shares email_reminders with admin hub
 * (claim target = reply id) so the patient gets one mail, not two.
 */
export async function sendUnsentInquiryUpdateEmails(): Promise<ReminderRunResult> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const { data: replies, error } = await supabaseAdmin
    .from("patient_feedback_replies")
    .select("id, feedback_id, body")
    .eq("author_role", "admin")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw new Error(error.message);

  const candidates = replies ?? [];
  if (candidates.length === 0) return { candidates: 0, sent: 0 };

  const feedbackIds = [...new Set(candidates.map((r) => r.feedback_id))];
  const { data: rows } = await supabaseAdmin
    .from("patient_feedback")
    .select("id, email, full_name, message, status")
    .in("id", feedbackIds);
  const feedbackById = new Map((rows ?? []).map((row) => [row.id, row]));

  let sent = 0;
  for (const reply of candidates) {
    const row = feedbackById.get(reply.feedback_id);
    const to = row?.email?.trim();
    if (!row || !to) continue;

    const { subject, html } = patientInquiryUpdateEmail({
      fullName: row.full_name,
      status: row.status,
      originalMessage: row.message,
      adminNote: reply.body,
      inquiriesUrl: `${appUrl()}/inquiries`,
    });

    if (
      await sendOnce(INQUIRY_UPDATE_CLAIM, reply.id, () =>
        sendTransactionalEmail({ to, subject, html }),
      )
    ) {
      sent += 1;
    }
  }

  return { candidates: candidates.length, sent };
}
