import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { planTitleFromDuration } from "@/lib/pricing";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { ELIGIBLE_SUBSCRIPTION_STATUSES, isQuickbloxConfigured } from "./config";
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
      .select("subscription_id, started_at")
      .eq("user_id", userId),
  ]);

  if (subsResult.error) throw new Error(subsResult.error.message);
  if (consultsResult.error && !/patient_consultations/i.test(consultsResult.error.message)) {
    throw new Error(consultsResult.error.message);
  }

  const startedBySub = new Map(
    (consultsResult.data ?? []).map((row) => [row.subscription_id, row.started_at]),
  );

  const plans: ConsultationPlanState[] = (subsResult.data ?? []).map((subscription) => {
    const medicine = (subscription as { medicines?: EmbeddedMedicine }).medicines ?? null;
    const pkg = (subscription as { packages?: EmbeddedPackage }).packages ?? null;
    return {
      subscriptionId: subscription.id,
      medicineName: medicine?.name ?? "Treatment plan",
      planLabel: pkg ? planTitleFromDuration(pkg.duration_months) : null,
      imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
      startedAt: startedBySub.get(subscription.id) ?? null,
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
