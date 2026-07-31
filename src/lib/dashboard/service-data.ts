import "server-only";

import { calculateBmiFromMetric } from "@/lib/intake/conversions";
import { DEFAULT_MEDICINE_IMAGE, resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { fetchCurrentMedication } from "@/lib/my-meds/service-data";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
        name: medicine.name,
        currentPlan: "—",
        variantDose: "—",
        nextRefillDate: null,
        imageSrc: toDbImageSrc(medicine.image_url),
      }
    : null;

  return { bmi, goals, treatment };
}

export async function fetchDashboardPageData(userId: string): Promise<DashboardPageDataDto> {
  const [{ data: profile }, currentMed, intake] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name, avatar_url").eq("id", userId).maybeSingle(),
    fetchCurrentMedication(userId).catch(() => null),
    fetchClaimedIntakeExtras(userId),
  ]);

  const treatmentFromSub: DashboardTreatmentDto | null = currentMed
    ? {
        medicineId: currentMed.medicineId,
        packageId: currentMed.packageId,
        variantId: currentMed.variantId,
        name: currentMed.medicationName,
        currentPlan: currentMed.currentPlan,
        variantDose: currentMed.variantName || currentMed.dosage || "—",
        nextRefillDate: currentMed.nextRefillDate,
        imageSrc: toDbImageSrc(currentMed.imageSrc),
      }
    : null;

  // Prefer active subscription medicine; fall back to claimed intake selection.
  const treatment = treatmentFromSub ?? intake.treatment;

  return {
    fullName: profile?.full_name?.trim() || "Patient",
    patientId: toPatientId(userId),
    avatarUrl: profile?.avatar_url?.trim() || null,
    bmi: intake.bmi,
    bmiCategory: getBmiCategory(intake.bmi),
    goals: intake.goals,
    treatment,
  };
}
