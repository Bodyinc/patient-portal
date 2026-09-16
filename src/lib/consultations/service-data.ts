import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { planTitleFromDuration } from "@/lib/pricing";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { ELIGIBLE_SUBSCRIPTION_STATUSES, isQuickbloxConfigured } from "./config";
import { fetchAppointmentStatuses } from "./quickblox";
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
  const [identity, onboardingComplete, subsResult, consultsResult] = await Promise.all([
    getPatientDisplayIdentity(userId),
    hasCompletedOnboarding(userId),
    supabaseAdmin
      .from("subscriptions")
      .select("id, status, created_at, medicines(name, image_url), packages(duration_months)")
      .eq("user_id", userId)
      .in("status", [...ELIGIBLE_SUBSCRIPTION_STATUSES])
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("patient_consultations")
      .select("id, subscription_id, started_at, ended_at, qb_appointment_id")
      .eq("user_id", userId),
  ]);

  if (subsResult.error) throw new Error(subsResult.error.message);

  let consultRowsRaw = consultsResult.data;
  let consultsError = consultsResult.error;
  if (consultsError && /ended_at/i.test(consultsError.message)) {
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
  }));

  const qbStatus = isQuickbloxConfigured()
    ? await fetchAppointmentStatuses(consultRows.map((row) => row.qb_appointment_id))
    : new Map();

  const now = new Date().toISOString();
  await Promise.all(
    consultRows.map(async (row) => {
      const live = qbStatus.get(row.qb_appointment_id);
      if (!live) return;
      if (!live.open && !row.ended_at) {
        const { error } = await supabaseAdmin
          .from("patient_consultations")
          .update({ ended_at: live.dateEnd || now, updated_at: now })
          .eq("id", row.id);
        if (error && !/ended_at/i.test(error.message)) {
          console.warn("[consultations] persist ended_at failed:", error.message);
        }
        row.ended_at = live.dateEnd || now;
      }
      if (live.open && row.ended_at) {
        const { error } = await supabaseAdmin
          .from("patient_consultations")
          .update({ ended_at: null, updated_at: now })
          .eq("id", row.id);
        if (error && !/ended_at/i.test(error.message)) {
          console.warn("[consultations] clear ended_at failed:", error.message);
        }
        row.ended_at = null;
      }
    }),
  );

  const startedBySub = new Map(
    consultRows.map((row) => {
      const live = qbStatus.get(row.qb_appointment_id);
      const visitStatus: "open" | "closed" = live
        ? live.open
          ? "open"
          : "closed"
        : row.ended_at
          ? "closed"
          : "open";
      return [
        row.subscription_id,
        {
          startedAt: row.started_at,
          endedAt: row.ended_at,
          visitStatus,
        },
      ];
    }),
  );

  const plans: ConsultationPlanState[] = (subsResult.data ?? []).map((subscription) => {
    const medicine = (subscription as { medicines?: EmbeddedMedicine }).medicines ?? null;
    const pkg = (subscription as { packages?: EmbeddedPackage }).packages ?? null;
    const started = startedBySub.get(subscription.id);
    return {
      subscriptionId: subscription.id,
      medicineName: medicine?.name ?? "Treatment plan",
      planLabel: pkg ? planTitleFromDuration(pkg.duration_months) : null,
      imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
      startedAt: started?.startedAt ?? null,
      endedAt: started?.endedAt ?? null,
      visitStatus: started?.visitStatus ?? null,
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
