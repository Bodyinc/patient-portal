import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import { sendTransactionalEmail } from "./send";
import { incompleteOrderEmail, refillReminderEmail } from "./reminder-emails";
import { orderStatusEmail, providerCaseAssignedEmail } from "./order-status-emails";
import { alreadySentKeys, markEmailSent, sendOnce } from "./idempotency";
import {
  adminAppUrl,
  adminNotifyEmail,
  appUrl,
  patientEmailsByIntakeSessionIds,
  patientEmailsByUserIds,
} from "./recipients";

const INCOMPLETE_ORDER_DELAY_HOURS = 24;
const REFILL_WINDOW_DAYS = 5;
// Daily Hobby cron. Keep a 3-day window so a failed immediate send is retried
// (already-sent rows in email_reminders are skipped).
const ORDER_EVENT_LOOKBACK_HOURS = 72;
const ACTIVE_INTAKE_STATUSES = ["in_progress", "payment_pending"] as const;

const ORDER_STATUS_EMAIL_STATUS_LIST = [
  "provider_assigned",
  "awaiting_additional_payment",
  "approved",
  "prescribed",
  "sent_to_pharmacy",
  "dispatched",
  "delivered",
  "rejected",
  "cancelled",
] as const;

/** Must match admin-hub `notifyPatientRequestEvent` so both apps share one claim. */
const PATIENT_STATUS_REMINDER = "order_status";

function shouldEmailPatientForEvent(status: string): boolean {
  // Admin hub already emails these the moment the clinician acts:
  // combined "Practitioner assigned — prescription under review", and additional payment.
  // Sending them again from this app is the duplicate Gmail pair.
  if (status === "provider_assigned") return false;
  if (status === "awaiting_additional_payment") return false;
  return true;
}

function patientStatusClaimTarget(
  status: string,
  eventId: string,
  requestId: string | undefined,
): { targetId: string; periodKey: string } {
  // One patient email per request+status, shared with admin-hub notifyPatientRequestEvent.
  if (requestId) return { targetId: requestId, periodKey: status };
  return { targetId: eventId, periodKey: "" };
}

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

export async function sendUnsentOrderStatusEmails(opts?: {
  requestId?: string;
  since?: Date;
}): Promise<ReminderRunResult> {
  let query = supabaseAdmin
    .from("medication_request_events")
    .select("id, request_id, status, actor_role, created_at")
    .in("status", [...ORDER_STATUS_EMAIL_STATUS_LIST])
    .order("created_at", { ascending: true });

  if (opts?.requestId) {
    query = query.eq("request_id", opts.requestId);
  } else {
    const since = opts?.since ?? new Date(Date.now() - ORDER_EVENT_LOOKBACK_HOURS * 60 * 60 * 1000);
    query = query.gte("created_at", since.toISOString());
  }

  const { data: events, error } = await query;
  if (error) throw new Error(error.message);

  const candidates = events ?? [];
  const requestIds = [...new Set(candidates.map((e) => e.request_id))];
  const providerEventIds = candidates
    .filter((e) => e.status === "provider_assigned")
    .map((e) => e.id);

  const [sentKeys, providerSentKeys, adminSentKeys, requestsResult] = await Promise.all([
    alreadySentKeys(PATIENT_STATUS_REMINDER, [...candidates.map((e) => e.id), ...requestIds]),
    alreadySentKeys("provider_assigned", providerEventIds),
    alreadySentKeys("admin_case_assigned", providerEventIds),
    requestIds.length
      ? supabaseAdmin
          .from("medication_requests")
          .select("id, user_id, session_id, medicine_id, provider_id, tracking_number")
          .in("id", requestIds)
      : Promise.resolve({ data: [] }),
  ]);

  const requestById = new Map((requestsResult.data ?? []).map((r) => [r.id, r]));
  const medicineIds = [
    ...new Set((requestsResult.data ?? []).map((r) => r.medicine_id).filter(Boolean)),
  ] as string[];
  const userIds = [
    ...new Set(
      (requestsResult.data ?? [])
        .flatMap((r) => [r.user_id, r.provider_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const sessionIds = [
    ...new Set(
      (requestsResult.data ?? [])
        .map((r) => r.session_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: medicines }, profileById, sessionById] = await Promise.all([
    medicineIds.length
      ? supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    patientEmailsByUserIds(userIds),
    patientEmailsByIntakeSessionIds(sessionIds),
  ]);
  const medicineById = new Map((medicines ?? []).map((m) => [m.id, m.name]));

  let sent = 0;
  for (const event of candidates) {
    const request = requestById.get(event.request_id);
    const medicineName =
      (request?.medicine_id ? medicineById.get(request.medicine_id) : null) ?? "your treatment";
    const orderNumber = request ? formatOrderId(request.id) : formatOrderId(event.request_id);
    const patient = request
      ? ((request.user_id ? profileById.get(request.user_id) : undefined) ??
        (request.session_id ? sessionById.get(request.session_id) : undefined) ??
        null)
      : null;

    if (!sentKeys.has(`${event.id}|`)) {
      if (!shouldEmailPatientForEvent(event.status)) {
        await markEmailSent(PATIENT_STATUS_REMINDER, event.id, "");
        sentKeys.add(`${event.id}|`);
      } else if (!patient) {
        console.warn("[email] order status skipped: no recipient yet", event.id);
      } else {
        const ctaUrl =
          event.status === "awaiting_additional_payment" && request
            ? `${appUrl()}/orders/${request.id}/pay`
            : event.status === "provider_assigned"
              ? `${appUrl()}/consultations`
              : `${appUrl()}/my-meds`;

        const mail = orderStatusEmail({
          fullName: patient.fullName,
          medicineName,
          status: event.status,
          orderNumber,
          ctaUrl,
          trackingNumber: request?.tracking_number,
        });

        const claim = patientStatusClaimTarget(event.status, event.id, request?.id);
        const claimKey = `${claim.targetId}|${claim.periodKey}`;

        if (!mail) {
          await markEmailSent(PATIENT_STATUS_REMINDER, event.id, "");
          sentKeys.add(`${event.id}|`);
        } else if (sentKeys.has(claimKey)) {
          await markEmailSent(PATIENT_STATUS_REMINDER, event.id, "");
          sentKeys.add(`${event.id}|`);
        } else if (
          await sendOnce(
            PATIENT_STATUS_REMINDER,
            claim.targetId,
            () =>
              sendTransactionalEmail({
                to: patient.email,
                subject: mail.subject,
                html: mail.html,
              }),
            claim.periodKey,
          )
        ) {
          sentKeys.add(claimKey);
          if (claim.targetId !== event.id) {
            await markEmailSent(PATIENT_STATUS_REMINDER, event.id, "");
          }
          sentKeys.add(`${event.id}|`);
          sent += 1;
        }
      }
    }

    if (event.status === "provider_assigned" && request) {
      const base = adminAppUrl();
      const caseUrl = base ? `${base}/cases/${request.id}` : null;
      const providerId = request.provider_id ?? null;
      let providerEmail: string | null = null;
      const provider = providerId ? (profileById.get(providerId) ?? null) : null;

      if (provider && !providerSentKeys.has(`${event.id}|`)) {
        providerEmail = provider.email;
        const providerMail = providerCaseAssignedEmail({
          providerName: provider.fullName,
          medicineName,
          orderNumber,
          patientName: patient?.fullName ?? null,
          caseUrl,
        });
        if (
          await sendOnce("provider_assigned", event.id, () =>
            sendTransactionalEmail({
              to: provider.email,
              subject: providerMail.subject,
              html: providerMail.html,
            }),
          )
        ) {
          providerSentKeys.add(`${event.id}|`);
          sent += 1;
        }
      }

      const adminTo = adminNotifyEmail();
      if (
        adminTo &&
        adminTo.toLowerCase() !== providerEmail?.toLowerCase() &&
        !adminSentKeys.has(`${event.id}|`)
      ) {
        const adminMail = providerCaseAssignedEmail({
          providerName: "team",
          medicineName,
          orderNumber,
          patientName: patient?.fullName ?? null,
          caseUrl,
        });
        if (
          await sendOnce("admin_case_assigned", event.id, () =>
            sendTransactionalEmail({
              to: adminTo,
              subject: `[Body Inc] New case — ${orderNumber}`,
              html: adminMail.html,
            }),
          )
        ) {
          adminSentKeys.add(`${event.id}|`);
          sent += 1;
        }
      }
    }
  }

  return { candidates: candidates.length, sent };
}

export async function sendOrderStatusEmails(now = new Date()): Promise<ReminderRunResult> {
  return sendUnsentOrderStatusEmails({
    since: new Date(now.getTime() - ORDER_EVENT_LOOKBACK_HOURS * 60 * 60 * 1000),
  });
}
