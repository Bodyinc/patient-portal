import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { planTitleFromDuration } from "@/lib/pricing";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { ELIGIBLE_SUBSCRIPTION_STATUSES, isQuickbloxConfigured } from "./config";
import { checkJotformSubmission } from "./jotform";
import {
  ensureQuickbloxClient,
  fetchAppointmentStatuses,
  getCachedClientSession,
} from "./quickblox";
import { readQbClientSession } from "./session-cookie";
import type { ConsultationPlanState, ConsultationsPageData } from "./types";

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

type EmbeddedMedicine = { name: string; image_url: string | null } | null;
type EmbeddedPackage = { duration_months: number | null } | null;

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("intake_sessions")
    .select("id")
    .eq("claimed_by_user_id", userId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function fetchConsultationsPageData(userId: string): Promise<ConsultationsPageData> {
  const [identity, onboardingComplete, subsResult, consultsResult, requestsResult] =
    await Promise.all([
      getPatientDisplayIdentity(userId),
      hasCompletedOnboarding(userId),
      supabaseAdmin
        .from("subscriptions")
        .select(
          "id, status, created_at, session_id, is_checkout_primary, checkout_group_id, medicines(name, image_url), packages(duration_months)",
        )
        .eq("user_id", userId)
        .in("status", [...ELIGIBLE_SUBSCRIPTION_STATUSES])
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("patient_consultations")
        .select(
          "id, subscription_id, started_at, ended_at, qb_appointment_id, form_submitted, form_submission_id, form_submitted_at",
        )
        .eq("user_id", userId),
      supabaseAdmin.from("medication_requests").select("id, subscription_id").eq("user_id", userId),
    ]);

  if (subsResult.error) throw new Error(subsResult.error.message);

  let consultRowsRaw = consultsResult.data;
  let consultsError = consultsResult.error;
  if (
    consultsError &&
    (/ended_at/i.test(consultsError.message) || /form_submitted/i.test(consultsError.message))
  ) {
    const retried = await supabaseAdmin
      .from("patient_consultations")
      .select("id, subscription_id, started_at, qb_appointment_id")
      .eq("user_id", userId);
    consultRowsRaw = retried.data as typeof consultRowsRaw;
    consultsError = retried.error;
  }
  if (consultsError && !/patient_consultations/i.test(consultsError.message)) {
    throw new Error(consultsError.message);
  }

  const consultRows = (consultRowsRaw ?? []).map((row) => ({
    ...row,
    ended_at: "ended_at" in row ? ((row as { ended_at?: string | null }).ended_at ?? null) : null,
    form_submitted:
      "form_submitted" in row
        ? Boolean((row as { form_submitted?: boolean | null }).form_submitted)
        : false,
    form_submission_id:
      "form_submission_id" in row
        ? ((row as { form_submission_id?: string | null }).form_submission_id ?? null)
        : null,
    form_submitted_at:
      "form_submitted_at" in row
        ? ((row as { form_submitted_at?: string | null }).form_submitted_at ?? null)
        : null,
  }));

  // Check if provider/doctor completed the visit via medication_request_events
  const requestIds = (requestsResult.data ?? []).map((r) => r.id);
  const completedEventsBySub = new Map<string, string>(); // subscription_id -> completed_at
  if (requestIds.length > 0) {
    const { data: events } = await supabaseAdmin
      .from("medication_request_events")
      .select("request_id, note, status, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    const subByReqId = new Map((requestsResult.data ?? []).map((r) => [r.id, r.subscription_id]));

    for (const ev of events ?? []) {
      const subId = subByReqId.get(ev.request_id);
      if (!subId || completedEventsBySub.has(subId)) continue;
      const note = (ev.note ?? "").toLowerCase();
      const status = (ev.status ?? "").toLowerCase();
      if (
        note.includes("consultation completed") ||
        note.includes("consultation finished") ||
        status === "consultation_completed" ||
        status === "consultation_finished"
      ) {
        completedEventsBySub.set(subId, ev.created_at);
      }
    }
  }

  const clientTokens: string[] = [];
  if (isQuickbloxConfigured()) {
    for (const row of consultRows) {
      let token =
        getCachedClientSession(userId, row.subscription_id)?.token ??
        (await readQbClientSession(userId, row.subscription_id))?.token;
      if (!token && !row.ended_at && row.qb_appointment_id) {
        try {
          const session = await ensureQuickbloxClient({
            userId,
            subscriptionId: row.subscription_id,
            fullName: identity.fullName,
            dob: "2000-01-01",
            sex: null,
          });
          token = session.token;
        } catch {
          // Non-fatal
        }
      }
      if (token) clientTokens.push(token);
    }
  }

  const qbStatus = isQuickbloxConfigured()
    ? await fetchAppointmentStatuses(
        consultRows.map((row) => row.qb_appointment_id),
        { clientTokens },
      )
    : new Map();

  const now = new Date().toISOString();
  await Promise.all(
    consultRows.map(async (row) => {
      const live = qbStatus.get(row.qb_appointment_id);
      if (!live) return;
      if (!live.open && !row.ended_at) {
        const finishTime = live.dateEnd || now;
        const { error } = await supabaseAdmin
          .from("patient_consultations")
          .update({ ended_at: finishTime, updated_at: now })
          .eq("id", row.id);
        if (error && !/ended_at/i.test(error.message)) {
          console.warn("[consultations] persist ended_at failed:", error.message);
        }
        row.ended_at = finishTime;
      }
    }),
  );

  const startedBySub = new Map(
    consultRows.map((row) => {
      const live = qbStatus.get(row.qb_appointment_id);
      const eventCompletedAt = completedEventsBySub.get(row.subscription_id) ?? null;
      const isEnded = Boolean(
        row.ended_at || eventCompletedAt || (live && (!live.open || Boolean(live.dateEnd))),
      );
      const visitStatus: "open" | "closed" = isEnded ? "closed" : "open";
      const endedAt = row.ended_at || eventCompletedAt || live?.dateEnd || null;
      const hasFormSubmission = Boolean(
        row.form_submitted ||
        row.form_submission_id ||
        live?.hasFormSubmission ||
        live?.formSubmissionId,
      );
      return [
        row.subscription_id,
        {
          startedAt: row.started_at,
          endedAt,
          visitStatus,
          hasFormSubmission,
          formSubmissionId: row.form_submission_id || live?.formSubmissionId || null,
        },
      ];
    }),
  );

  const subscriptionRows = (subsResult.data ?? []) as Array<
    (typeof subsResult.data)[number] & {
      is_checkout_primary?: boolean | null;
      checkout_group_id?: string | null;
    }
  >;
  const visibleSubscriptions = subscriptionRows.filter(
    (subscription) => subscription.is_checkout_primary !== false,
  );

  const plans: ConsultationPlanState[] = visibleSubscriptions.map((subscription) => {
    const medicine = (subscription as { medicines?: EmbeddedMedicine }).medicines ?? null;
    const pkg = (subscription as { packages?: EmbeddedPackage }).packages ?? null;
    const groupId = subscription.checkout_group_id;
    const group = groupId
      ? subscriptionRows
          .filter((row) => row.checkout_group_id === groupId)
          .sort(
            (a, b) =>
              (a.is_checkout_primary === false ? 1 : 0) - (b.is_checkout_primary === false ? 1 : 0),
          )
      : [subscription];
    const groupNames = group
      .map((row) => (row as { medicines?: EmbeddedMedicine }).medicines?.name)
      .filter((name): name is string => Boolean(name));
    const started = startedBySub.get(subscription.id);
    const eventCompletedAt = completedEventsBySub.get(subscription.id) ?? null;
    const isFinished =
      started?.visitStatus === "closed" || Boolean(started?.endedAt) || Boolean(eventCompletedAt);
    const visitStatus: "open" | "closed" | null = isFinished
      ? "closed"
      : (started?.visitStatus ?? null);
    const endedAt = started?.endedAt || eventCompletedAt || null;
    const hasFormSubmission = Boolean(started?.hasFormSubmission);

    return {
      subscriptionId: subscription.id,
      medicineName:
        groupNames.length > 1 ? groupNames.join(", ") : (medicine?.name ?? "Treatment plan"),
      planLabel:
        groupNames.length > 1
          ? "One consultation for this order"
          : pkg
            ? planTitleFromDuration(pkg.duration_months)
            : null,
      imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
      startedAt: started?.startedAt ?? null,
      endedAt,
      visitStatus,
      hasFormSubmission,
      formSubmissionId: started?.formSubmissionId || null,
    };
  });

  return {
    configured: isQuickbloxConfigured(),
    onboardingComplete,
    fullName: identity.fullName,
    patientId: toPatientId(userId),
    avatarUrl: identity.avatarUrl,
    plans,
  };
}
