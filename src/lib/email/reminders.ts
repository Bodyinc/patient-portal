import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import { sendTransactionalEmail } from "./send";
import { incompleteOrderEmail, refillReminderEmail } from "./reminder-emails";
import { orderStatusEmail } from "./order-status-emails";
import { alreadySentKeys, markEmailSent } from "./idempotency";
import { appUrl, patientEmailByUserId } from "./recipients";

const INCOMPLETE_ORDER_DELAY_HOURS = 24;
const REFILL_WINDOW_DAYS = 5;
const ORDER_EVENT_LOOKBACK_HOURS = 24;
const ACTIVE_INTAKE_STATUSES = ["in_progress", "payment_pending"] as const;

const ORDER_STATUS_EMAIL_STATUSES = new Set([
  "provider_assigned",
  "pending_review",
  "awaiting_additional_payment",
  "approved",
  "prescribed",
  "sent_to_pharmacy",
  "dispatched",
  "delivered",
  "rejected",
  "cancelled",
]);

export type ReminderRunResult = { candidates: number; sent: number };

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
      await markEmailSent("incomplete_order", session.id, "");
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
      await markEmailSent("refill", sub.id, periodKey);
      sent += 1;
    }
  }

  return { candidates: candidates.length, sent };
}

export async function sendOrderStatusEmails(now = new Date()): Promise<ReminderRunResult> {
  const since = new Date(now.getTime() - ORDER_EVENT_LOOKBACK_HOURS * 60 * 60 * 1000);

  const { data: events, error } = await supabaseAdmin
    .from("medication_request_events")
    .select("id, request_id, status, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const candidates = (events ?? []).filter((ev) => ORDER_STATUS_EMAIL_STATUSES.has(ev.status));
  const sentKeys = await alreadySentKeys(
    "order_status",
    candidates.map((e) => e.id),
  );

  const requestIds = [...new Set(candidates.map((e) => e.request_id))];
  const { data: requests } = requestIds.length
    ? await supabaseAdmin
        .from("medication_requests")
        .select("id, user_id, medicine_id, provider_id, tracking_number")
        .in("id", requestIds)
    : { data: [] };

  const requestById = new Map((requests ?? []).map((r) => [r.id, r]));
  const medicineIds = [
    ...new Set((requests ?? []).map((r) => r.medicine_id).filter(Boolean)),
  ] as string[];
  const { data: medicines } = medicineIds.length
    ? await supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
    : { data: [] };
  const medicineById = new Map((medicines ?? []).map((m) => [m.id, m.name]));

  let sent = 0;
  for (const event of candidates) {
    const request = requestById.get(event.request_id);
    const medicineName =
      (request?.medicine_id ? medicineById.get(request.medicine_id) : null) ?? "your treatment";
    const orderNumber = request ? formatOrderId(request.id) : formatOrderId(event.request_id);

    if (!sentKeys.has(`${event.id}|`)) {
      if (!request?.user_id) {
        await markEmailSent("order_status", event.id, "");
        sentKeys.add(`${event.id}|`);
      } else {
        const patient = await patientEmailByUserId(request.user_id);
        if (!patient) {
          await markEmailSent("order_status", event.id, "");
          sentKeys.add(`${event.id}|`);
        } else {
          const ctaUrl =
            event.status === "awaiting_additional_payment"
              ? `${appUrl()}/orders/${request.id}/pay`
              : `${appUrl()}/my-meds`;

          const mail = orderStatusEmail({
            fullName: patient.fullName,
            medicineName,
            status: event.status,
            orderNumber,
            ctaUrl,
            trackingNumber: request.tracking_number,
          });

          if (
            mail &&
            (await sendTransactionalEmail({
              to: patient.email,
              subject: mail.subject,
              html: mail.html,
            }))
          ) {
            await markEmailSent("order_status", event.id, "");
            sentKeys.add(`${event.id}|`);
            sent += 1;
          } else if (!mail) {
            await markEmailSent("order_status", event.id, "");
            sentKeys.add(`${event.id}|`);
          }
        }
      }
    }
  }

  return { candidates: candidates.length, sent };
}
