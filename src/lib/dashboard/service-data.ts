import "server-only";

import { calculateBmiFromMetric } from "@/lib/intake/conversions";
import { DEFAULT_MEDICINE_IMAGE, resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { healAndFetchPendingAdditionalPayments } from "@/lib/orders/additional-payment";
import { fetchActiveMedications } from "@/lib/my-meds/service-data";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import { maybeReconcileIncompleteSubscription } from "@/lib/stripe/reconcile";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { consultationAnchorId } from "@/lib/checkout/group";
import { attachExistingIntakeToOpenOrders } from "@/lib/intake/attach-intake";
import { isQuickbloxConfigured } from "@/lib/consultations/config";
import { loadConsultationEligibility } from "@/lib/consultations/eligibility";
import { isConsultationFinishedEvent } from "@/lib/consultations/finished";
import { fetchAppointmentStatuses, getCachedClientSession } from "@/lib/consultations/quickblox";
import { readQbClientSession } from "@/lib/consultations/session-cookie";

import type { DashboardGoalDto, DashboardPageDataDto, DashboardTreatmentDto } from "./types";

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

function getBmiCategory(bmi: number | null): string {
  if (bmi === null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function toDbImageSrc(imageUrl: string | null | undefined): string | null {
  const resolved = resolveMedicineImageSrc(imageUrl);
  if (!resolved || resolved === DEFAULT_MEDICINE_IMAGE) return null;
  return resolved;
}

function resolveCategoryImageSrc(
  categoryImageUrl: string | null | undefined,
  icon: string | null | undefined,
): string | null {
  const categoryImageTrimmed = categoryImageUrl?.trim();
  if (categoryImageTrimmed) return categoryImageTrimmed;

  const iconTrimmed = icon?.trim();
  if (
    iconTrimmed &&
    (iconTrimmed.startsWith("http://") ||
      iconTrimmed.startsWith("https://") ||
      iconTrimmed.startsWith("/"))
  ) {
    return iconTrimmed;
  }

  return null;
}

async function fetchClaimedIntakeExtras(userId: string): Promise<{
  bmi: number | null;
  goals: DashboardGoalDto[];
  treatment: DashboardTreatmentDto | null;
}> {
  const { data: session } = await supabaseAdmin
    .from("intake_sessions")
    .select("id, height_cm, weight_kg")
    .eq("claimed_by_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { bmi: null, goals: [], treatment: null };
  }

  const bmi =
    session.height_cm !== null && session.weight_kg !== null
      ? calculateBmiFromMetric(Number(session.height_cm), Number(session.weight_kg))
      : null;

  const [categoriesResult, medicineResult] = await Promise.all([
    supabaseAdmin
      .from("intake_session_categories")
      .select("category_id, medication_categories(id, name, icon, image_url)")
      .eq("session_id", session.id),
    supabaseAdmin
      .from("intake_session_medicines")
      .select("medicine_id, medicines(id, name, short_description, image_url)")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const goals: DashboardGoalDto[] = (categoriesResult.data ?? []).flatMap((row) => {
    const category =
      (
        row as {
          medication_categories?: {
            id: string;
            name: string;
            icon: string | null;
            image_url: string | null;
          } | null;
        }
      ).medication_categories ?? null;
    if (!category) return [];
    return [
      {
        id: category.id,
        name: category.name,
        imageSrc: resolveCategoryImageSrc(category.image_url, category.icon),
      },
    ];
  });

  const medicine =
    (
      medicineResult.data as {
        medicines?: {
          id: string;
          name: string;
          short_description: string | null;
          image_url: string | null;
        } | null;
      } | null
    )?.medicines ?? null;

  const treatment: DashboardTreatmentDto | null = medicine
    ? {
        medicineId: medicine.id,
        packageId: null,
        variantId: null,
        subscriptionId: null,
        name: medicine.name,
        currentPlan: "—",
        variantDose: "—",
        nextRefillDate: null,
        imageSrc: toDbImageSrc(medicine.image_url),
        consultationStatus: "none",
        canRequestRefill: false,
        trackingNumber: null,
        consultationApproved: false,
      }
    : null;

  return { bmi, goals, treatment };
}

function isClosedOrderStatus(status: string | null | undefined): boolean {
  return status === "rejected" || status === "cancelled";
}

export async function fetchDashboardPageData(userId: string): Promise<DashboardPageDataDto> {
  const completedIntakeSessionId = await attachExistingIntakeToOpenOrders(userId);
  const [didReconcile, pendingPayments, identity, activeMeds, intake, requestRows, eligibility] =
    await Promise.all([
      maybeReconcileIncompleteSubscription(userId).catch((err) => {
        console.error("[stripe] dashboard incomplete reconcile failed:", err);
        return false;
      }),
      healAndFetchPendingAdditionalPayments(userId).catch((err) => {
        console.error("[additional_payments] dashboard load failed:", err);
        return [] as Awaited<ReturnType<typeof healAndFetchPendingAdditionalPayments>>;
      }),
      getPatientDisplayIdentity(userId),
      fetchActiveMedications(userId, { reconcile: false }).catch(() => []),
      fetchClaimedIntakeExtras(userId),
      supabaseAdmin
        .from("medication_requests")
        .select("id, subscription_id, medicine_id, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      loadConsultationEligibility(userId),
    ]);

  const requests = requestRows.data ?? [];
  if (requestRows.error) {
    console.error("[dashboard] medication requests load failed:", requestRows.error.message);
  }

  const latestOverall = requests[0] ?? null;
  const latestOrderClosed = isClosedOrderStatus(latestOverall?.status);
  const latestBySubscription = new Map<string, (typeof requests)[number]>();
  const latestByMedicine = new Map<string, (typeof requests)[number]>();
  for (const row of requests) {
    if (row.subscription_id && !latestBySubscription.has(row.subscription_id)) {
      latestBySubscription.set(row.subscription_id, row);
    }
    if (row.medicine_id && !latestByMedicine.has(row.medicine_id)) {
      latestByMedicine.set(row.medicine_id, row);
    }
  }

  const meds =
    didReconcile === true
      ? await fetchActiveMedications(userId, { reconcile: false }).catch(() => activeMeds)
      : activeMeds;

  const visibleMeds = meds.filter((med) => {
    const latest =
      (med.subscriptionId ? latestBySubscription.get(med.subscriptionId) : undefined) ??
      (med.medicineId ? latestByMedicine.get(med.medicineId) : undefined);
    return !isClosedOrderStatus(latest?.status);
  });

  const currentMed = visibleMeds[0] ?? null;
  let consultationStatus: DashboardTreatmentDto["consultationStatus"] = "none";
  let intakeSubmitted = Boolean(completedIntakeSessionId);
  const consultationSubscriptionId = currentMed?.subscriptionId
    ? await consultationAnchorId(currentMed.subscriptionId)
    : null;
  if (consultationSubscriptionId) {
    let visit: {
      qb_appointment_id: string;
      ended_at?: string | null;
      form_submitted?: boolean | null;
      form_submission_id?: string | null;
    } | null = null;
    const first = await supabaseAdmin
      .from("patient_consultations")
      .select("qb_appointment_id, ended_at, form_submitted, form_submission_id")
      .eq("user_id", userId)
      .eq("subscription_id", consultationSubscriptionId)
      .maybeSingle();
    if (
      first.error &&
      (/ended_at/i.test(first.error.message) || /form_submitted/i.test(first.error.message))
    ) {
      const retried = await supabaseAdmin
        .from("patient_consultations")
        .select("qb_appointment_id")
        .eq("user_id", userId)
        .eq("subscription_id", consultationSubscriptionId)
        .maybeSingle();
      visit = retried.data;
    } else if (first.error && !/patient_consultations/i.test(first.error.message)) {
      throw new Error(first.error.message);
    } else {
      visit = first.data;
    }

    if (visit?.form_submitted || visit?.form_submission_id) intakeSubmitted = true;

    if (visit?.qb_appointment_id) {
      consultationStatus = visit.ended_at ? "closed" : "open";
      // A still-open QuickBlox room must not undo a visit the provider already finished.
      if (consultationStatus !== "closed" && isQuickbloxConfigured()) {
        const clientToken =
          getCachedClientSession(userId, consultationSubscriptionId)?.token ??
          (await readQbClientSession(userId, consultationSubscriptionId))?.token;
        const live = (
          await fetchAppointmentStatuses([visit.qb_appointment_id], { clientToken })
        ).get(visit.qb_appointment_id);
        if (live?.hasFormSubmission || live?.formSubmissionId) intakeSubmitted = true;
        if (live && !live.open) consultationStatus = "closed";
      }
    }

    if (visit && consultationStatus !== "closed") {
      const subscriptionIds = new Set<string>([consultationSubscriptionId]);
      const { data: anchorSub } = await supabaseAdmin
        .from("subscriptions")
        .select("checkout_group_id")
        .eq("id", consultationSubscriptionId)
        .maybeSingle();
      if (anchorSub?.checkout_group_id) {
        const { data: siblings } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("checkout_group_id", anchorSub.checkout_group_id);
        for (const row of siblings ?? []) subscriptionIds.add(row.id);
      }
      const requestIds = requests
        .filter((row) => row.subscription_id && subscriptionIds.has(row.subscription_id))
        .map((row) => row.id);
      if (requestIds.length > 0) {
        const { data: events } = await supabaseAdmin
          .from("medication_request_events")
          .select("note, status")
          .in("request_id", requestIds);
        if ((events ?? []).some((ev) => isConsultationFinishedEvent(ev))) {
          consultationStatus = "closed";
        }
      }
    }
  }

  const checkoutMeds = currentMed
    ? visibleMeds.filter((med) =>
        currentMed.checkoutGroupId
          ? med.checkoutGroupId === currentMed.checkoutGroupId
          : med.subscriptionId === currentMed.subscriptionId,
      )
    : [];
  const displayMeds = checkoutMeds.length > 0 ? checkoutMeds : currentMed ? [currentMed] : [];
  const planNames = [...new Set(displayMeds.map((med) => med.currentPlan).filter(Boolean))];
  const doses = [
    ...new Set(
      displayMeds
        .map((med) => med.variantName || med.dosage)
        .filter((value) => value && value !== "—"),
    ),
  ];
  const treatmentFromSub: DashboardTreatmentDto | null = currentMed
    ? {
        medicineId: currentMed.medicineId,
        packageId: currentMed.packageId,
        variantId: currentMed.variantId,
        subscriptionId: currentMed.subscriptionId,
        name: displayMeds.map((med) => med.medicationName).join(", "),
        currentPlan: planNames.join(", ") || currentMed.currentPlan,
        variantDose: doses.join(", ") || "—",
        nextRefillDate: currentMed.nextRefillDate,
        imageSrc: toDbImageSrc(currentMed.imageSrc),
        consultationStatus,
        canRequestRefill: currentMed.canRequestRefill,
        trackingNumber: currentMed.trackingNumber,
        consultationApproved: currentMed.consultationApproved,
      }
    : null;

  // Prefer an active, non-rejected subscription medicine. After a provider rejects an
  // order the subscription is cancelled, so do not fall back to the intake selection.
  const intakeTreatmentClosed = isClosedOrderStatus(
    intake.treatment?.medicineId
      ? latestByMedicine.get(intake.treatment.medicineId)?.status
      : latestOverall?.status,
  );
  const treatment = treatmentFromSub ?? (intakeTreatmentClosed ? null : intake.treatment);

  return {
    fullName: identity.fullName,
    patientId: toPatientId(userId),
    avatarUrl: identity.avatarUrl,
    bmi: intake.bmi,
    bmiCategory: getBmiCategory(intake.bmi),
    goals: intake.goals,
    treatment,
    activeTreatmentCount: new Set(
      visibleMeds.map((med) => med.checkoutGroupId ?? med.subscriptionId),
    ).size,
    pendingPayments,
    consultationsEnabled: isQuickbloxConfigured(),
    consultationRequired: Boolean(
      currentMed?.subscriptionId &&
      eligibility.needingSubscriptionIds.has(currentMed.subscriptionId),
    ),
    consultationVisit: Boolean(
      currentMed?.subscriptionId && eligibility.visitSubscriptionIds.has(currentMed.subscriptionId),
    ),
    intakeSubmitted,
    latestOrderClosed,
  };
}
