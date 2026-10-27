import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import { patientStatusLabel } from "@/lib/orders/status";
import { formatPortalDate } from "@/lib/date-format";
import { sendPushToUser } from "@/lib/push/send";
import { sendTransactionalEmail } from "./send";
import { incompleteOrderEmail, refillReminderEmail } from "./reminder-emails";
import {
  orderStatusEmail,
  providerCaseAssignedEmail,
  trackingIdEmail,
} from "./order-status-emails";
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

function shouldEmailPatientForEvent(status: string, actorRole: string | null): boolean {
  // DB trigger writes provider_assigned at pay time. Patient mail waits until an
  // admin/provider actually assigns — one combined assigned + under-review email.
  if (status === "provider_assigned" && actorRole === "system") return false;
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
      if (sub.user_id) {
        const medicineName =
          (sub.medicine_id ? medicineById.get(sub.medicine_id)?.name : null) ??
          "Treatment Subscription";
        const renewal = formatPortalDate(sub.current_period_end);
        await sendPushToUser(sub.user_id, {
          title: "Upcoming refill",
          body: `Your ${medicineName} refill renews on ${renewal}.`,
          url: "/billing",
        }).catch((error) => console.error("[push] refill reminder failed:", error));
      }
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
          .select(
            "id, user_id, session_id, medicine_id, provider_id, tracking_number, requires_consultation",
          )
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
      ? supabaseAdmin
          .from("medicines")
          .select("id, name, requires_consultation")
          .in("id", medicineIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; name: string; requires_consultation: boolean }>,
        }),
    patientEmailsByUserIds(userIds),
    patientEmailsByIntakeSessionIds(sessionIds),
  ]);
  const medicineById = new Map((medicines ?? []).map((m) => [m.id, m.name]));
  const consultationByMedicineId = new Map(
    (medicines ?? []).map((m) => [m.id, Boolean(m.requires_consultation)]),
  );

  const extraPayRequestIds = [
    ...new Set(
      candidates.filter((e) => e.status === "awaiting_additional_payment").map((e) => e.request_id),
    ),
  ];
  const extraPayByRequest = new Map<string, { amount_cents: number; currency: string }>();
  if (extraPayRequestIds.length > 0) {
    const { data: extras } = await supabaseAdmin
      .from("additional_payments")
      .select("request_id, amount_cents, currency")
      .in("request_id", extraPayRequestIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    for (const row of extras ?? []) {
      if (extraPayByRequest.has(row.request_id)) continue;
      extraPayByRequest.set(row.request_id, {
        amount_cents: row.amount_cents,
        currency: row.currency ?? "usd",
      });
    }
  }

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
      if (!shouldEmailPatientForEvent(event.status, event.actor_role)) {
        await markEmailSent(PATIENT_STATUS_REMINDER, event.id, "");
        sentKeys.add(`${event.id}|`);
      } else if (!patient) {
        console.warn("[email] order status skipped: no recipient yet", event.id);
      } else {
        const extraPay = extraPayByRequest.get(event.request_id);
        const needsConsultation = Boolean(
          request?.requires_consultation ||
          (request?.medicine_id && consultationByMedicineId.get(request.medicine_id)),
        );
        const ctaUrl =
          event.status === "awaiting_additional_payment" && request
            ? `${appUrl()}/orders/${request.id}/pay`
            : event.status === "provider_assigned" && needsConsultation
              ? `${appUrl()}/consultations`
              : `${appUrl()}/my-meds`;

        const mail = orderStatusEmail({
          fullName: patient.fullName,
          medicineName,
          status: event.status,
          orderNumber,
          ctaUrl,
          trackingNumber: request?.tracking_number,
          amountCents: extraPay?.amount_cents,
          currency: extraPay?.currency,
          consultationApproved: Boolean(request?.requires_consultation),
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
          if (request?.user_id) {
            const pushUrl =
              event.status === "awaiting_additional_payment"
                ? `/orders/${request.id}/pay`
                : event.status === "provider_assigned"
                  ? "/consultations"
                  : "/my-meds";
            const pushTitle =
              event.status === "provider_assigned"
                ? "Practitioner assigned"
                : patientStatusLabel(event.status);
            await sendPushToUser(request.user_id, {
              title: pushTitle,
              body: `${medicineName} · ${orderNumber}`,
              url: pushUrl,
            }).catch((error) => console.error("[push] order status failed:", error));
          }
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

const TRACKING_EMAIL_REMINDER = "tracking_id";

/** Mail the patient when a tracking ID is saved on their order, including if it arrives after dispatch. */
export async function sendTrackingIdEmails(now = new Date()): Promise<ReminderRunResult> {
  const since = new Date(now.getTime() - ORDER_EVENT_LOOKBACK_HOURS * 60 * 60 * 1000);
  const { data, error } = await supabaseAdmin
    .from("medication_requests")
    .select("id, user_id, session_id, medicine_id, tracking_number")
    .not("tracking_number", "is", null)
    .gte("updated_at", since.toISOString());
  if (error) throw new Error(error.message);

  const candidates = (data ?? []).filter((row) => Boolean(row.tracking_number?.trim()));
  const sentKeys = await alreadySentKeys(
    TRACKING_EMAIL_REMINDER,
    candidates.map((row) => row.id),
  );

  const medicineIds = [
    ...new Set(candidates.map((row) => row.medicine_id).filter(Boolean)),
  ] as string[];
  const userIds = [...new Set(candidates.map((row) => row.user_id).filter(Boolean))] as string[];
  const sessionIds = [
    ...new Set(candidates.map((row) => row.session_id).filter(Boolean)),
  ] as string[];

  const [{ data: medicines }, profileById, sessionById] = await Promise.all([
    medicineIds.length
      ? supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    patientEmailsByUserIds(userIds),
    patientEmailsByIntakeSessionIds(sessionIds),
  ]);
  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine.name]));

  let sent = 0;
  for (const request of candidates) {
    const trackingNumber = request.tracking_number?.trim();
    if (!trackingNumber) continue;
    const periodKey = trackingNumber.slice(0, 180);
    if (sentKeys.has(`${request.id}|${periodKey}`)) continue;

    const patient =
      (request.user_id ? profileById.get(request.user_id) : undefined) ??
      (request.session_id ? sessionById.get(request.session_id) : undefined) ??
      null;
    if (!patient?.email) {
      console.warn("[email] tracking id skipped: no recipient yet", request.id);
      continue;
    }

    const medicineName =
      (request.medicine_id ? medicineById.get(request.medicine_id) : null) ?? "your treatment";
    const mail = trackingIdEmail({
      fullName: patient.fullName,
      medicineName,
      orderNumber: formatOrderId(request.id),
      trackingNumber,
      ctaUrl: `${appUrl()}/my-meds`,
    });

    if (
      await sendOnce(
        TRACKING_EMAIL_REMINDER,
        request.id,
        () =>
          sendTransactionalEmail({
            to: patient.email,
            subject: mail.subject,
            html: mail.html,
          }),
        periodKey,
      )
    ) {
      sentKeys.add(`${request.id}|${periodKey}`);
      sent += 1;
      if (request.user_id) {
        await sendPushToUser(request.user_id, {
          title: "Tracking ID ready",
          body: `${medicineName} · ${trackingNumber.slice(0, 80)}`,
          url: "/my-meds",
        }).catch((pushError) => console.error("[push] tracking id failed:", pushError));
      }
    }
  }

  return { candidates: candidates.length, sent };
}
