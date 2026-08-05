"use server";

import { z } from "zod";

import {
  combineEligibilityResults,
  evaluateCategoryRules,
  evaluateQuestionnaireResponses,
  hasQuestionnaireResponses,
  type CategoryEligibilityRules,
} from "@/lib/intake/eligibility";
import { calculateBmiFromMetric, toHeightCm, toWeightKg } from "@/lib/intake/conversions";
import {
  clearSessionTokenCookie,
  createIntakeSession,
  getSessionTokenFromCookie,
  requireIntakeSession,
  resolveIntakeSession,
  type IntakeSessionRow,
} from "@/lib/intake/session";
import { linkOnboardingStripeToUser } from "@/lib/stripe/customers";
import { reconcileLatestSubscriptionForUser } from "@/lib/stripe/reconcile";
import { getPublicFees } from "@/lib/actions/fees";
import { hasPassword } from "@/lib/actions/patient-auth";
import { attachReferralFromCookie, maybeConvertReferral } from "@/lib/referrals";
import { createClient } from "@/lib/supabase/server";
import type {
  CategoryDto,
  EligibilityResultDto,
  IntakeActionResult,
  IntakeSummaryDto,
  IntakeVariantOption,
  MedicineDto,
  MedicinesForCategoryDto,
  PackageDto,
  QuestionnaireDto,
  QuestionnaireResponseInput,
} from "@/lib/intake/types";
import { normalizeQuestionType } from "@/lib/intake/questionnaire";
import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { formatOrderId } from "@/lib/orders/order-id";
import { classifyPatientEmail } from "@/lib/auth/patient-email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DOB_SCHEMA, OPTIONAL_PHONE_SCHEMA, PHONE_SCHEMA } from "@/lib/validation";
import type { Json } from "@/lib/supabase/types";

function parseImportantInfo(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseFeatures(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseEligibilityRules(value: Json): CategoryEligibilityRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CategoryEligibilityRules;
}

function isMedicineCatalogVisible(medicine: { is_active: boolean; status: string }) {
  if (!medicine.is_active) return false;
  return medicine.status === "active" || medicine.status === "published";
}

async function getSessionCategory(sessionId: string) {
  // Embedded select: link + category in one round trip (was two sequential queries).
  const { data: link } = await supabaseAdmin
    .from("intake_session_categories")
    .select("category_id, medication_categories(id, slug, name, eligibility_rules)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const category = link?.medication_categories ?? null;
  if (!category) return null;

  return {
    category_id: category.id,
    medication_categories: category,
  };
}

async function getSessionMedicineLink(sessionId: string) {
  const { data: link } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("medicine_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return link;
}

async function categoryHasActiveQuestionnaire(categoryId: string): Promise<boolean> {
  const { data: links, error: linkError } = await supabaseAdmin
    .from("questionnaire_categories")
    .select("questionnaire_id")
    .eq("category_id", categoryId);

  if (linkError || !links?.length) return false;

  const questionnaireIds = links.map((l) => l.questionnaire_id);
  const { data: active } = await supabaseAdmin
    .from("questionnaires")
    .select("id")
    .in("id", questionnaireIds)
    .eq("is_active", true)
    .limit(1);

  return (active ?? []).length > 0;
}

type EmbeddedQuestionOption = {
  id: string;
  question_id: string;
  label: string;
  sort_order: number;
};
type EmbeddedQuestion = {
  id: string;
  prompt: string;
  description: string | null;
  question_type: string;
  is_required: boolean;
  sort_order: number;
  questionnaire_question_options: EmbeddedQuestionOption[] | null;
};

function mapQuestionnaireDto(questionnaire: {
  id: string;
  name: string;
  questionnaire_questions: EmbeddedQuestion[] | null;
}): QuestionnaireDto {
  const questions = [...(questionnaire.questionnaire_questions ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return {
    id: questionnaire.id,
    title: questionnaire.name,
    questions: questions.map((q) => ({
      id: q.id,
      text: q.prompt,
      description: q.description,
      questionType: normalizeQuestionType(q.question_type),
      isRequired: q.is_required,
      options: [...(q.questionnaire_question_options ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => ({ id: o.id, label: o.label })),
    })),
  };
}

// Single round trip: questionnaire + its questions + each question's options, via nested
// PostgREST embeds (was 3 separate sequential queries).
async function loadQuestionnaireDto(
  questionnaireIds: string[],
): Promise<IntakeActionResult<QuestionnaireDto | null>> {
  const { data: questionnaire, error } = await supabaseAdmin
    .from("questionnaires")
    .select(
      "id, name, questionnaire_questions(id, prompt, description, question_type, is_required, sort_order, questionnaire_question_options(id, question_id, label, sort_order))",
    )
    .in("id", questionnaireIds)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "fetch_error", message: error.message };
  }
  if (!questionnaire) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: mapQuestionnaireDto(
      questionnaire as unknown as Parameters<typeof mapQuestionnaireDto>[0],
    ),
  };
}

async function buildIntakeSummary(
  sessionId: string,
  existingSession?: IntakeSessionRow,
): Promise<IntakeSummaryDto | null> {
  let session = existingSession ?? null;

  if (!session) {
    const { data } = await supabaseAdmin
      .from("intake_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    session = data;
  }

  if (!session) return null;

  // One parallel wave (was three sequential ones): the medicine rides along on the
  // link query as an embedded select, and eligibility is fetched per-session then
  // matched to the current medicine in JS.
  const [categoryLink, medicineLinkResult, packageResult, eligibilityResult] = await Promise.all([
    getSessionCategory(sessionId),
    supabaseAdmin
      .from("intake_session_medicines")
      .select("medicine_id, medicines(id, name)")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    session.selected_plan_id
      ? supabaseAdmin
          .from("packages")
          .select("id, name, duration_months, price, medicine_variants(name)")
          .eq("id", session.selected_plan_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("intake_session_eligibility_results")
      .select("result, medicine_id")
      .eq("session_id", sessionId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const medicineId = medicineLinkResult.data?.medicine_id ?? null;
  const medicine =
    (medicineLinkResult.data as { medicines?: { id: string; name: string } | null } | null)
      ?.medicines ?? null;
  const packageData = packageResult.data;
  // Prefer medicine-scoped eligibility; fall back to goal-level (null medicine_id) results
  // recorded when the questionnaire ran before medicine selection.
  const eligibilityRaw = eligibilityResult.data;
  const eligibility =
    eligibilityRaw &&
    (eligibilityRaw.medicine_id === medicineId ||
      eligibilityRaw.medicine_id === null ||
      medicineId === null)
      ? eligibilityRaw
      : null;

  const requiresQuestionnaire = categoryLink?.category_id
    ? await categoryHasActiveQuestionnaire(categoryLink.category_id)
    : false;

  const bmi =
    session.height_cm !== null && session.weight_kg !== null
      ? calculateBmiFromMetric(Number(session.height_cm), Number(session.weight_kg))
      : null;

  return {
    sessionId: session.id,
    goalSlug: categoryLink?.medication_categories?.slug ?? null,
    goalName: categoryLink?.medication_categories?.name ?? null,
    stateCode: session.state_code,
    sex: session.sex,
    dob: session.dob,
    heightCm: session.height_cm !== null ? Number(session.height_cm) : null,
    weightKg: session.weight_kg !== null ? Number(session.weight_kg) : null,
    bmi,
    fullName: session.full_name,
    email: session.email,
    phone: session.phone,
    streetAddress: session.street_address,
    apartment: session.apartment,
    city: session.city,
    postalCode: session.postal_code,
    billingSameAsShipping: session.billing_same_as_shipping,
    billingStreetAddress: session.billing_street_address,
    billingApartment: session.billing_apartment,
    billingCity: session.billing_city,
    billingStateCode: session.billing_state_code,
    billingPostalCode: session.billing_postal_code,
    smsConsent: session.sms_consent,
    marketingConsent: session.marketing_consent,
    medicineId: medicine?.id ?? null,
    medicineName: medicine?.name ?? null,
    requiresQuestionnaire,
    selectedPackageId: session.selected_plan_id,
    packageName: packageData?.name ?? null,
    variantName:
      (packageData as { medicine_variants?: { name: string } | null } | null)?.medicine_variants
        ?.name ?? null,
    packageDurationMonths: packageData?.duration_months ?? null,
    packagePrice: packageData?.price !== undefined ? Number(packageData.price) : null,
    eligibilityResult: eligibility?.result ?? null,
    status: session.status,
  };
}

export async function ensureIntakeSession(): Promise<IntakeActionResult<{ sessionId: string }>> {
  const token = await getSessionTokenFromCookie();
  if (token) {
    const { session, error } = await resolveIntakeSession(token);
    if (session) {
      return { ok: true, data: { sessionId: session.id } };
    }
    if (error) {
      await clearSessionTokenCookie();
    }
  }

  const created = await createIntakeSession();
  if ("error" in created) {
    return { ok: false, code: "create_error", message: created.error };
  }

  return { ok: true, data: { sessionId: created.session.id } };
}

function resolveCategoryImageSrc(
  categoryImageUrl: string | null | undefined,
  icon: string | null | undefined,
  medicineImageUrl: string | null | undefined,
): string | null {
  const categoryImageTrimmed = categoryImageUrl?.trim();
  if (categoryImageTrimmed) {
    return categoryImageTrimmed;
  }

  const iconTrimmed = icon?.trim();
  if (
    iconTrimmed &&
    (iconTrimmed.startsWith("http://") ||
      iconTrimmed.startsWith("https://") ||
      iconTrimmed.startsWith("/"))
  ) {
    return iconTrimmed;
  }

  const medicineTrimmed = medicineImageUrl?.trim();
  return medicineTrimmed || null;
}

export async function getActiveCategories(): Promise<IntakeActionResult<CategoryDto[]>> {
  const { data, error } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name, tagline, description, icon, image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return { ok: false, code: "fetch_error", message: error.message };
  }

  const categories = data ?? [];
  const categoryIds = categories.map((c) => c.id);

  const firstMedicineImageByCategory = new Map<string, string | null>();

  if (categoryIds.length > 0) {
    const { data: links } = await supabaseAdmin
      .from("medication_category_medicines")
      .select("category_id, medicine_id, sort_order")
      .in("category_id", categoryIds)
      .order("sort_order", { ascending: true });

    const medicineIds = [...new Set((links ?? []).map((l) => l.medicine_id))];
    const imageByMedicineId = new Map<string, string | null>();

    if (medicineIds.length > 0) {
      const { data: medicines } = await supabaseAdmin
        .from("medicines")
        .select("id, image_url")
        .in("id", medicineIds);

      for (const med of medicines ?? []) {
        imageByMedicineId.set(med.id, med.image_url);
      }
    }

    for (const link of links ?? []) {
      if (firstMedicineImageByCategory.has(link.category_id)) continue;
      firstMedicineImageByCategory.set(
        link.category_id,
        imageByMedicineId.get(link.medicine_id) ?? null,
      );
    }
  }

  return {
    ok: true,
    data: categories.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      icon: row.icon,
      imageSrc: resolveCategoryImageSrc(
        row.image_url,
        row.icon,
        firstMedicineImageByCategory.get(row.id),
      ),
    })),
  };
}

export async function getMedicinesForCategory(
  categorySlug: string,
): Promise<IntakeActionResult<MedicinesForCategoryDto>> {
  const { data: category, error: categoryError } = await supabaseAdmin
    .from("medication_categories")
    .select("id, name, eligibility_rules")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError || !category) {
    return { ok: false, code: "not_found", message: "Category not found" };
  }

  const sessionResult = await requireIntakeSession();
  const session = "session" in sessionResult ? sessionResult.session : null;

  const { data: links, error } = await supabaseAdmin
    .from("medication_category_medicines")
    .select("sort_order, medicine_id")
    .eq("category_id", category.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return { ok: false, code: "fetch_error", message: error.message };
  }

  const rules = parseEligibilityRules(category.eligibility_rules);
  const categoryEligibility =
    session !== null
      ? evaluateCategoryRules(session, rules)
      : { result: "eligible" as const, reason: null };

  if (categoryEligibility.result === "ineligible") {
    return {
      ok: true,
      data: {
        medicines: [],
        categoryEligible: false,
        ineligibleReason: categoryEligibility.reason,
      },
    };
  }

  const medicineIds = (links ?? []).map((l) => l.medicine_id);
  if (medicineIds.length === 0) {
    return {
      ok: true,
      data: { medicines: [], categoryEligible: true, ineligibleReason: null },
    };
  }

  const { data: meds, error: medsError } = await supabaseAdmin
    .from("medicines")
    .select(
      "id, name, short_description, long_description, image_url, from_price_cents, important_info, notice_text, is_active, status, sort_order",
    )
    .in("id", medicineIds);

  if (medsError) {
    return { ok: false, code: "fetch_error", message: medsError.message };
  }

  const { data: variantRows } = await supabaseAdmin
    .from("medicine_variants")
    .select("id, medicine_id, name, from_price_cents")
    .in("medicine_id", medicineIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const variantsByMedicineId = new Map<string, IntakeVariantOption[]>();
  for (const v of variantRows ?? []) {
    const list = variantsByMedicineId.get(v.medicine_id) ?? [];
    list.push({
      id: v.id,
      name: v.name,
      fromPriceCents: v.from_price_cents == null ? null : Number(v.from_price_cents),
    });
    variantsByMedicineId.set(v.medicine_id, list);
  }

  const medMap = new Map((meds ?? []).map((m) => [m.id, m]));
  const medicines: MedicineDto[] = [];

  for (const link of links ?? []) {
    const med = medMap.get(link.medicine_id);
    if (!med || !isMedicineCatalogVisible(med)) continue;

    medicines.push({
      id: med.id,
      name: med.name,
      tag: category.name,
      description: med.short_description,
      detailDescription: med.long_description ?? med.short_description,
      importantInfo: parseImportantInfo(med.important_info),
      notice: med.notice_text ?? "",
      imageSrc: resolveMedicineImageSrc(med.image_url),
      fromPriceCents: med.from_price_cents == null ? null : Number(med.from_price_cents),
      variants: variantsByMedicineId.get(med.id) ?? [],
    });
  }

  return {
    ok: true,
    data: { medicines, categoryEligible: true, ineligibleReason: null },
  };
}

export async function saveIntakeCategory(
  categorySlug: string,
): Promise<
  IntakeActionResult<{ categoryId: string; goalName: string; requiresQuestionnaire: boolean }>
> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const sessionId = sessionResult.session.id;

  const { data: category, error: categoryError } = await supabaseAdmin
    .from("medication_categories")
    .select("id, name")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError || !category) {
    return { ok: false, code: "not_found", message: "Category not found" };
  }

  // Clear all questionnaire / eligibility for this session (medicine-scoped and goal-level).
  await Promise.all([
    supabaseAdmin.from("intake_session_categories").delete().eq("session_id", sessionId),
    supabaseAdmin.from("intake_session_medicines").delete().eq("session_id", sessionId),
    supabaseAdmin
      .from("intake_session_questionnaire_responses")
      .delete()
      .eq("session_id", sessionId),
    supabaseAdmin.from("intake_session_eligibility_results").delete().eq("session_id", sessionId),
    supabaseAdmin.from("intake_sessions").update({ selected_plan_id: null }).eq("id", sessionId),
  ]);

  const { error } = await supabaseAdmin.from("intake_session_categories").insert({
    session_id: sessionId,
    category_id: category.id,
  });

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  const requiresQuestionnaire = await categoryHasActiveQuestionnaire(category.id);

  return {
    ok: true,
    data: {
      categoryId: category.id,
      goalName: category.name,
      requiresQuestionnaire,
    },
  };
}

const demographicsSchema = z.object({
  stateCode: z.string().trim().min(2).max(2),
  sex: z.enum(["male", "female", "other"]),
  dob: DOB_SCHEMA,
});

export async function saveIntakeDemographics(
  input: z.infer<typeof demographicsSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const parsed = demographicsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const data = parsed.data;

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({
      state_code: data.stateCode,
      sex: data.sex,
      dob: data.dob,
    })
    .eq("id", sessionResult.session.id);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

const bmiSchema = z.object({
  heightFeet: z.number().min(1).max(8),
  heightInches: z.number().min(0).max(11),
  weightLbs: z.number().positive().max(1500),
});

export async function saveIntakeBmi(
  input: z.infer<typeof bmiSchema>,
): Promise<IntakeActionResult<{ bmi: number }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const parsed = bmiSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid measurements.",
    };
  }
  const data = parsed.data;
  const heightCm = toHeightCm(data.heightFeet, data.heightInches);
  const weightKg = toWeightKg(data.weightLbs);
  const bmi = calculateBmiFromMetric(heightCm, weightKg);

  if (bmi === null) {
    return { ok: false, code: "invalid_bmi", message: "Could not calculate BMI" };
  }

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({ height_cm: heightCm, weight_kg: weightKg })
    .eq("id", sessionResult.session.id);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { bmi } };
}

export async function saveIntakeMedicine(
  medicineId: string,
): Promise<IntakeActionResult<{ medicineId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const categoryLink = await getSessionCategory(sessionResult.session.id);
  if (!categoryLink?.category_id) {
    return { ok: false, code: "no_category", message: "Select a goal first" };
  }

  const { data: medicine, error: medError } = await supabaseAdmin
    .from("medicines")
    .select("id, is_active, status")
    .eq("id", medicineId)
    .maybeSingle();

  if (medError || !medicine || !isMedicineCatalogVisible(medicine)) {
    return { ok: false, code: "not_found", message: "Medicine not found" };
  }

  // Clear any previously selected plan; questionnaire/eligibility are goal-level and
  // will be reassigned to this medicine below (not wiped).
  await supabaseAdmin
    .from("intake_sessions")
    .update({ selected_plan_id: null })
    .eq("id", sessionResult.session.id);

  const { data: existingLinks } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("category_id")
    .eq("session_id", sessionResult.session.id);

  const otherCategoryIds = (existingLinks ?? [])
    .map((l) => l.category_id)
    .filter((id) => id !== categoryLink.category_id);

  if (otherCategoryIds.length > 0) {
    await supabaseAdmin
      .from("intake_session_medicines")
      .delete()
      .eq("session_id", sessionResult.session.id)
      .in("category_id", otherCategoryIds);
  }

  const { error } = await supabaseAdmin.from("intake_session_medicines").upsert(
    {
      session_id: sessionResult.session.id,
      category_id: categoryLink.category_id,
      medicine_id: medicineId,
    },
    { onConflict: "session_id,category_id" },
  );

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  // Attach (or re-attach) session questionnaire / eligibility rows to the selected
  // medicine so downstream checkout checks that expect medicine_id continue to work.
  await Promise.all([
    supabaseAdmin
      .from("intake_session_questionnaire_responses")
      .update({ medicine_id: medicineId })
      .eq("session_id", sessionResult.session.id),
    supabaseAdmin
      .from("intake_session_eligibility_results")
      .update({ medicine_id: medicineId })
      .eq("session_id", sessionResult.session.id),
  ]);

  return { ok: true, data: { medicineId: medicine.id } };
}

const contactSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  // Phone is collected on delivery-address; optional here for confirm-email contact step.
  phone: OPTIONAL_PHONE_SCHEMA,
});

export async function saveIntakeContact(
  input: z.infer<typeof contactSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  // Onboarding is new-patients-only: reject an email that already has an account so a
  // client-side bypass can't seed an existing identity into the intake session.
  const emailCheck = await classifyPatientEmail(email);
  if (emailCheck.status === "patient") {
    return {
      ok: false,
      code: "email_exists",
      message: "An account with this email already exists. Please log in instead.",
    };
  }
  if (emailCheck.status === "wrong_portal") {
    return {
      ok: false,
      code: "wrong_portal",
      message: `An account with this email already exists on the ${emailCheck.role} portal.`,
    };
  }
  if (emailCheck.status === "invalid" || emailCheck.status === "error") {
    return { ok: false, code: "email_check_failed", message: "Could not verify that email." };
  }

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({
      full_name: data.fullName,
      email,
      phone: data.phone || "",
    })
    .eq("id", sessionResult.session.id);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

const addressSchema = z
  .object({
    streetAddress: z.string().trim().min(1, "Enter your address").max(255),
    apartment: z.string().trim().min(1, "Enter your apartment number").max(60),
    city: z.string().trim().min(1, "Enter your city").max(120),
    postalCode: z.string().trim().min(3, "Enter your ZIP code").max(20),
    phone: PHONE_SCHEMA,
    billingSameAsShipping: z.boolean(),
    billingStreetAddress: z.string().trim().max(255).optional().or(z.literal("")),
    billingApartment: z.string().trim().max(60).optional().or(z.literal("")),
    billingCity: z.string().trim().max(120).optional().or(z.literal("")),
    billingStateCode: z.string().trim().max(2).optional().or(z.literal("")),
    billingPostalCode: z.string().trim().max(20).optional().or(z.literal("")),
    smsConsent: z.boolean(),
    marketingConsent: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!data.smsConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smsConsent"],
        message: "SMS consent is required to continue.",
      });
    }
    if (data.billingSameAsShipping) return;
    const required: [keyof typeof data, string][] = [
      ["billingStreetAddress", "Enter your billing address"],
      ["billingCity", "Enter your billing city"],
      ["billingStateCode", "Select your billing state"],
      ["billingPostalCode", "Enter your billing ZIP code"],
    ];
    for (const [key, message] of required) {
      if (!String(data[key] ?? "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message });
      }
    }
  });

export async function saveIntakeAddress(
  input: z.infer<typeof addressSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const data = parsed.data;
  const same = data.billingSameAsShipping;

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({
      street_address: data.streetAddress,
      apartment: data.apartment,
      city: data.city,
      postal_code: data.postalCode,
      phone: data.phone,
      billing_same_as_shipping: same,
      billing_street_address: same ? null : data.billingStreetAddress || null,
      billing_apartment: same ? null : data.billingApartment || null,
      billing_city: same ? null : data.billingCity || null,
      billing_state_code: same ? null : data.billingStateCode || null,
      billing_postal_code: same ? null : data.billingPostalCode || null,
      sms_consent: data.smsConsent,
      marketing_consent: data.marketingConsent,
    })
    .eq("id", sessionResult.session.id);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

export async function getQuestionnaireForCategory(
  categorySlug: string,
): Promise<IntakeActionResult<QuestionnaireDto | null>> {
  const { data: category, error: categoryError } = await supabaseAdmin
    .from("medication_categories")
    .select("id")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError) {
    return { ok: false, code: "fetch_error", message: categoryError.message };
  }
  if (!category) {
    return { ok: true, data: null };
  }

  const { data: questionnaireLinks, error: questionnaireLinkError } = await supabaseAdmin
    .from("questionnaire_categories")
    .select("questionnaire_id")
    .eq("category_id", category.id);

  if (questionnaireLinkError) {
    return { ok: false, code: "fetch_error", message: questionnaireLinkError.message };
  }

  const questionnaireIds = (questionnaireLinks ?? []).map((l) => l.questionnaire_id);
  if (questionnaireIds.length === 0) {
    return { ok: true, data: null };
  }

  return loadQuestionnaireDto(questionnaireIds);
}

export async function getCategoryRequiresQuestionnaire(
  categorySlug: string,
): Promise<IntakeActionResult<boolean>> {
  const { data: category, error: categoryError } = await supabaseAdmin
    .from("medication_categories")
    .select("id")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError) {
    return { ok: false, code: "fetch_error", message: categoryError.message };
  }
  if (!category) {
    return { ok: true, data: false };
  }

  return { ok: true, data: await categoryHasActiveQuestionnaire(category.id) };
}

/** @deprecated Prefer getQuestionnaireForCategory — questionnaires are linked to categories. */
export async function getQuestionnaireForMedicine(
  medicineId: string,
): Promise<IntakeActionResult<QuestionnaireDto | null>> {
  const { data: categoryLink, error: categoryLinkError } = await supabaseAdmin
    .from("medication_category_medicines")
    .select("category_id, medication_categories(slug)")
    .eq("medicine_id", medicineId)
    .limit(1)
    .maybeSingle();

  if (categoryLinkError) {
    return { ok: false, code: "fetch_error", message: categoryLinkError.message };
  }

  const slug = (categoryLink as { medication_categories?: { slug: string } | null } | null)
    ?.medication_categories?.slug;

  if (!slug) {
    return { ok: true, data: null };
  }

  return getQuestionnaireForCategory(slug);
}

/**
 * Persist questionnaire answers for the current intake session.
 * Pass `medicineId: null` when the patient has not chosen a medicine yet
 * (goal-level screening after BMI). Questionnaire is session-scoped: prior
 * answers for the session are always replaced.
 */
export async function saveQuestionnaireResponses(
  medicineId: string | null,
  responses: QuestionnaireResponseInput[],
): Promise<IntakeActionResult<{ saved: number }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const sessionId = sessionResult.session.id;

  await supabaseAdmin
    .from("intake_session_questionnaire_responses")
    .delete()
    .eq("session_id", sessionId);

  const MAX_ANSWER_TEXT = 5000;
  const rows = responses.map((response) => {
    const answerText =
      typeof response.answerText === "string"
        ? response.answerText.slice(0, MAX_ANSWER_TEXT)
        : null;
    const answerNumber =
      typeof response.answerNumber === "number" && Number.isFinite(response.answerNumber)
        ? response.answerNumber
        : null;
    return {
      session_id: sessionId,
      medicine_id: medicineId,
      question_id: response.questionId,
      answer_text: answerText,
      answer_number: answerNumber,
      answer_boolean: response.answerBoolean ?? null,
      answer_option_ids: response.optionIds ?? [],
    };
  });

  if (rows.length === 0) {
    return { ok: true, data: { saved: 0 } };
  }

  const { error } = await supabaseAdmin.from("intake_session_questionnaire_responses").insert(rows);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { saved: rows.length } };
}

/**
 * Evaluate eligibility for the current session.
 * Pass `medicineId: null` for goal-level evaluation before medicine selection.
 * Responses are loaded session-wide (goal-level questionnaire).
 */
export async function evaluateMedicineEligibility(
  medicineId: string | null = null,
): Promise<IntakeActionResult<EligibilityResultDto>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const session = sessionResult.session;
  const categoryLink = await getSessionCategory(session.id);
  const rules = parseEligibilityRules(categoryLink?.medication_categories?.eligibility_rules ?? {});

  const categoryResult = evaluateCategoryRules(session, rules);

  const { data: responses } = await supabaseAdmin
    .from("intake_session_questionnaire_responses")
    .select("question_id, answer_option_ids, answer_boolean, answer_text, answer_number")
    .eq("session_id", session.id);

  let questionnaireResult: EligibilityResultDto = { result: "eligible", reason: null };

  if (hasQuestionnaireResponses(responses ?? [])) {
    const optionIds = (responses ?? []).flatMap((r) => r.answer_option_ids);
    const questionIds = [...new Set((responses ?? []).map((r) => r.question_id))];

    const [optionsResult, questionsResult] = await Promise.all([
      optionIds.length > 0
        ? supabaseAdmin
            .from("questionnaire_question_options")
            .select("id, label, is_disqualifying")
            .in("id", optionIds)
        : Promise.resolve({
            data: [] as { id: string; label: string; is_disqualifying: boolean }[],
          }),
      questionIds.length > 0
        ? supabaseAdmin
            .from("questionnaire_questions")
            .select("id, prompt, question_type, disqualify_rules")
            .in("id", questionIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              prompt: string;
              question_type: string;
              disqualify_rules: Json;
            }[],
          }),
    ]);

    questionnaireResult = evaluateQuestionnaireResponses(
      responses ?? [],
      optionsResult.data ?? [],
      questionsResult.data ?? [],
    );
  }

  const finalResult = combineEligibilityResults([categoryResult, questionnaireResult]);

  // Replace prior eligibility for this session so hydration picks up the latest row.
  await supabaseAdmin
    .from("intake_session_eligibility_results")
    .delete()
    .eq("session_id", session.id);

  await supabaseAdmin.from("intake_session_eligibility_results").insert({
    session_id: session.id,
    medicine_id: medicineId,
    result: finalResult.result,
    reason: finalResult.reason,
  });

  return { ok: true, data: finalResult };
}

export async function getPackagesForMedicine(
  medicineId: string,
  variantId?: string | null,
): Promise<IntakeActionResult<PackageDto[]>> {
  // A package with no stripe_price_id cannot be charged — checkout rejects it with "This plan is
  // not available for purchase yet". Exclude it here so the patient never picks a dead plan and
  // only discovers it after completing the whole intake.
  let query = supabaseAdmin
    .from("packages")
    .select("*")
    .eq("medicine_id", medicineId)
    .eq("is_active", true)
    .not("stripe_price_id", "is", null)
    .order("duration_months", { ascending: true });
  // Packages belong to a variant when one is chosen, otherwise to the medicine directly.
  query = variantId ? query.eq("variant_id", variantId) : query.is("variant_id", null);
  const { data, error } = await query;

  if (error) {
    return { ok: false, code: "fetch_error", message: error.message };
  }

  return {
    ok: true,
    data: (data ?? []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      durationMonths: pkg.duration_months,
      originalPrice: Number(pkg.original_price),
      price: Number(pkg.price),
      isMostPopular: pkg.is_most_popular,
      features: parseFeatures(pkg.features),
      clinicalNote: pkg.clinical_note,
    })),
  };
}

export async function saveSelectedPlan(
  packageId: string,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const medicineLink = await getSessionMedicineLink(sessionResult.session.id);
  if (!medicineLink?.medicine_id) {
    return { ok: false, code: "no_medicine", message: "Select a medication first" };
  }

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from("packages")
    .select("id, is_active, medicine_id, stripe_price_id")
    .eq("id", packageId)
    .maybeSingle();

  if (pkgError || !pkg || !pkg.is_active) {
    return { ok: false, code: "not_found", message: "Plan not found" };
  }

  if (!pkg.stripe_price_id) {
    return {
      ok: false,
      code: "invalid_plan",
      message: "This plan is not available for purchase yet.",
    };
  }

  if (pkg.medicine_id !== medicineLink.medicine_id) {
    return { ok: false, code: "invalid_plan", message: "Plan does not match selected medication" };
  }

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({ selected_plan_id: packageId })
    .eq("id", sessionResult.session.id);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

export async function confirmCheckoutStub(): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const summary = await buildIntakeSummary(sessionResult.session.id, sessionResult.session);
  if (!summary) {
    return { ok: false, code: "session_error", message: "Session not found" };
  }

  if (!summary.selectedPackageId) {
    return { ok: false, code: "no_plan", message: "Select a treatment plan first" };
  }

  if (!summary.medicineId) {
    return { ok: false, code: "no_medicine", message: "Select a medication first" };
  }

  const { data: pkg } = await supabaseAdmin
    .from("packages")
    .select("medicine_id, is_active, stripe_price_id")
    .eq("id", summary.selectedPackageId)
    .maybeSingle();

  if (!pkg?.is_active || pkg.medicine_id !== summary.medicineId) {
    return { ok: false, code: "invalid_plan", message: "Selected plan is not valid" };
  }

  if (!pkg.stripe_price_id) {
    return {
      ok: false,
      code: "invalid_plan",
      message: "This plan is not available for purchase yet.",
    };
  }

  if (summary.requiresQuestionnaire && summary.eligibilityResult === "ineligible") {
    return {
      ok: false,
      code: "ineligible",
      message: "You are not eligible for this treatment based on your responses.",
    };
  }

  return { ok: true, data: { sessionId: summary.sessionId } };
}

export async function getIntakeSummary(): Promise<IntakeActionResult<IntakeSummaryDto | null>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: true, data: null };
  }

  const summary = await buildIntakeSummary(sessionResult.session.id, sessionResult.session);
  return { ok: true, data: summary };
}

export async function hydrateIntakeState(): Promise<IntakeActionResult<IntakeSummaryDto | null>> {
  const ensured = await ensureIntakeSession();
  if (!ensured.ok) {
    return ensured;
  }

  return getIntakeSummary();
}

export async function completeIntakeSession(): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  if (sessionResult.session.status === "completed") {
    return { ok: true, data: { sessionId: sessionResult.session.id } };
  }

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({ status: "completed" })
    .eq("id", sessionResult.session.id);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

/** Backstop for onboarding confirmation — same self-heal as authenticated /order-confirmation. */
export async function reconcileOnboardingSubscription(): Promise<IntakeActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "auth_error", message: "Authentication required." };
  }

  try {
    await reconcileLatestSubscriptionForUser(user.id);
    return { ok: true, data: null };
  } catch (error) {
    console.error("[stripe] reconcile onboarding confirmation failed:", error);
    return {
      ok: false,
      code: "reconcile_error",
      message: error instanceof Error ? error.message : "Unable to reconcile subscription.",
    };
  }
}

function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Order number + date chips on the onboarding confirmation page.
 * Prefers the session payment id, then medication_request id, then session id.
 * Allows completed sessions because confirmation marks the session complete on mount.
 */
export async function getOnboardingOrderMeta(): Promise<
  IntakeActionResult<{ orderNumber: string; orderDate: string }>
> {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return { ok: false, code: "session_error", message: "No intake session" };
  }

  const { session, error } = await resolveIntakeSession(token, { allowCompleted: true });
  if (!session || error) {
    return { ok: false, code: "session_error", message: error ?? "Invalid session" };
  }

  const [paymentResult, requestResult] = await Promise.all([
    supabaseAdmin
      .from("payments")
      .select("id, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("medication_requests")
      .select("id, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const payment = paymentResult.data;
  if (payment) {
    return {
      ok: true,
      data: {
        orderNumber: formatOrderId(payment.id),
        orderDate: formatOrderDate(payment.created_at),
      },
    };
  }

  const request = requestResult.data;
  if (request) {
    return {
      ok: true,
      data: {
        orderNumber: formatOrderId(request.id),
        orderDate: formatOrderDate(request.created_at),
      },
    };
  }

  return {
    ok: true,
    data: {
      orderNumber: formatOrderId(session.id),
      orderDate: formatOrderDate(session.updated_at ?? session.created_at),
    },
  };
}

/**
 * Order summary card on onboarding confirmation. Must allow completed sessions because
 * the page marks the session complete on mount (getIntakeSummary would then return null).
 */
export async function getOnboardingOrderSummary(): Promise<
  IntakeActionResult<{
    medicineName: string | null;
    variantName: string | null;
    packageName: string | null;
    packagePrice: number | null;
    totalPaid: number | null;
    email: string | null;
  }>
> {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return { ok: false, code: "session_error", message: "No intake session" };
  }

  const { session, error } = await resolveIntakeSession(token, { allowCompleted: true });
  if (!session || error) {
    return { ok: false, code: "session_error", message: error ?? "Invalid session" };
  }

  const [summary, paymentResult] = await Promise.all([
    buildIntakeSummary(session.id, session),
    supabaseAdmin
      .from("payments")
      .select("amount_cents")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!summary) {
    return { ok: false, code: "not_found", message: "Order summary unavailable" };
  }

  const paidCents = paymentResult.data?.amount_cents;
  const totalPaid =
    paidCents != null
      ? Number(paidCents) / 100
      : summary.packagePrice != null
        ? Number(summary.packagePrice)
        : null;

  return {
    ok: true,
    data: {
      medicineName: summary.medicineName,
      variantName: summary.variantName,
      packageName: summary.packageName,
      packagePrice: summary.packagePrice,
      totalPaid,
      email: summary.email?.trim() || null,
    },
  };
}

/**
 * Single entry point for the onboarding confirmation page.
 *
 * Next.js serializes server actions from the same client, so the page previously paid for
 * seven queued round trips (complete + reconcile + meta + summary x2 + fees + hasPassword),
 * each re-resolving the intake session. This does the same work in one round trip with a
 * single session resolve and one parallel wave.
 */
export async function getOnboardingConfirmationData(): Promise<
  IntakeActionResult<{
    orderNumber: string;
    orderDate: string;
    medicineName: string | null;
    variantName: string | null;
    packageName: string | null;
    packagePrice: number | null;
    totalPaid: number | null;
    email: string | null;
    renewalShippingCents: number;
    passwordSet: boolean;
  }>
> {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return { ok: false, code: "session_error", message: "No intake session" };
  }

  const { session, error } = await resolveIntakeSession(token, { allowCompleted: true });
  if (!session || error) {
    return { ok: false, code: "session_error", message: error ?? "Invalid session" };
  }

  // Reconcile before reading payments so Total Paid reflects the real charge. Cheap after the
  // first pass — alreadyReconciled() short-circuits without touching Stripe.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await reconcileLatestSubscriptionForUser(user.id);
  } catch (reconcileError) {
    console.error("[stripe] reconcile on onboarding confirmation failed:", reconcileError);
  }

  const [summary, paymentResult, requestResult, fees, passwordSet] = await Promise.all([
    buildIntakeSummary(session.id, session),
    supabaseAdmin
      .from("payments")
      .select("id, amount_cents, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("medication_requests")
      .select("id, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getPublicFees(),
    hasPassword(),
    session.status === "completed"
      ? Promise.resolve(null)
      : supabaseAdmin.from("intake_sessions").update({ status: "completed" }).eq("id", session.id),
  ]);

  if (!summary) {
    return { ok: false, code: "not_found", message: "Order summary unavailable" };
  }

  const payment = paymentResult.data;
  const request = requestResult.data;
  const paidCents = payment?.amount_cents;
  const totalPaid =
    paidCents != null
      ? Number(paidCents) / 100
      : summary.packagePrice != null
        ? Number(summary.packagePrice)
        : null;

  const orderSource = payment ?? request;

  return {
    ok: true,
    data: {
      orderNumber: formatOrderId(orderSource?.id ?? session.id),
      orderDate: formatOrderDate(
        orderSource?.created_at ?? session.updated_at ?? session.created_at,
      ),
      medicineName: summary.medicineName,
      variantName: summary.variantName,
      packageName: summary.packageName,
      packagePrice: summary.packagePrice,
      totalPaid,
      email: summary.email?.trim() || null,
      renewalShippingCents: fees.shippingFeeCents,
      passwordSet,
    },
  };
}

export async function claimIntakeSession(userId: string): Promise<void> {
  // Referral attach must never break signup, and runs before the intake-token check
  // so direct signups (no onboarding session) still get linked to their referrer.
  try {
    await attachReferralFromCookie(userId);
  } catch (error) {
    console.error("[referrals] attach on signup failed:", error);
  }

  const token = await getSessionTokenFromCookie();
  if (!token) return;

  const { session } = await resolveIntakeSession(token, { allowCompleted: true });
  if (!session) return;

  await supabaseAdmin
    .from("intake_sessions")
    .update({ claimed_by_user_id: userId })
    .eq("id", session.id);

  await supabaseAdmin
    .from("profiles")
    .update({
      full_name: session.full_name ?? undefined,
      phone: session.phone,
      dob: session.dob,
      state_code: session.state_code,
      sex: session.sex,
      street_address: session.street_address,
      apartment: session.apartment,
      city: session.city,
      postal_code: session.postal_code,
      country: "US",
      sms_consent: session.sms_consent,
      marketing_consent: session.marketing_consent,
    })
    .eq("id", userId);

  // Link guest onboarding orders (created at payment, before the account existed) to the
  // new patient so they appear in the patient's order tracking.
  await supabaseAdmin
    .from("medication_requests")
    .update({ user_id: userId })
    .eq("session_id", session.id)
    .is("user_id", null);

  // Always attribute session-scoped Stripe rows to this account.
  await supabaseAdmin
    .from("subscriptions")
    .update({ user_id: userId })
    .eq("session_id", session.id)
    .is("user_id", null);
  await supabaseAdmin
    .from("payments")
    .update({ user_id: userId })
    .eq("session_id", session.id)
    .is("user_id", null);

  if (session.stripe_customer_id) {
    try {
      await linkOnboardingStripeToUser({
        sessionId: session.id,
        stripeCustomerId: session.stripe_customer_id,
        userId,
      });
    } catch (error) {
      console.error("[stripe] linkOnboardingStripeToUser failed:", error);
    }
    // The onboarding payment happened as a guest, so it only becomes attributable to
    // this user after the linking above — re-check the referral conversion now.
    try {
      await maybeConvertReferral(userId);
    } catch (error) {
      console.error("[referrals] convert after claim failed:", error);
    }
  }

  // Self-heal without waiting on webhooks: promote incomplete → active and record payment.
  try {
    await reconcileLatestSubscriptionForUser(userId);
  } catch (error) {
    console.error("[stripe] reconcile after claim failed:", error);
  }
}
