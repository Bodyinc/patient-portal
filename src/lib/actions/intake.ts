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
import { fetchActiveCategories } from "@/lib/intake/categories";
import { loadCheckoutCart } from "@/lib/intake/session-cart";
import { normalizeQuestionType, parseDisqualifyRules } from "@/lib/intake/questionnaire";
import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { formatPortalDate } from "@/lib/date-format";
import { formatOrderId } from "@/lib/orders/order-id";
import { isUsStateCode } from "@/lib/profile/us-states";
import { userFacingMessage } from "@/lib/user-message";
import { classifyPatientEmail } from "@/lib/auth/patient-email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DOB_SCHEMA,
  OPTIONAL_PHONE_SCHEMA,
  OPTIONAL_ZIP_CODE_SCHEMA,
  PHONE_COUNTRY_CODE_SCHEMA,
  ZIP_CODE_SCHEMA,
  digitsOnlyZip,
  isValidNationalPhone,
} from "@/lib/validation";
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

function categoryHasEligibilityRules(rules: CategoryEligibilityRules): boolean {
  return Boolean(
    rules.blocked_state_codes?.length ||
    rules.sex?.length ||
    rules.allowed_sex?.length ||
    rules.bmi_bands?.length ||
    rules.min_age != null ||
    rules.max_age != null ||
    rules.min_bmi != null ||
    rules.max_bmi != null,
  );
}

function isMedicineCatalogVisible(medicine: { is_active: boolean; status: string }) {
  if (!medicine.is_active) return false;
  return medicine.status === "active" || medicine.status === "published";
}

async function getSessionCategory(sessionId: string) {
  const { data: primaryMed } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("category_id")
    .eq("session_id", sessionId)
    .eq("is_primary", true)
    .maybeSingle();

  let categoryId = primaryMed?.category_id ?? null;
  if (!categoryId) {
    const { data: link } = await supabaseAdmin
      .from("intake_session_categories")
      .select("category_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    categoryId = link?.category_id ?? null;
  }
  if (!categoryId) return null;

  const { data: category } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name, eligibility_rules")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category) return null;

  return {
    category_id: category.id,
    medication_categories: category,
  };
}

async function getSessionMedicineLink(sessionId: string) {
  const { data: primary } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("medicine_id")
    .eq("session_id", sessionId)
    .eq("is_primary", true)
    .maybeSingle();
  if (primary?.medicine_id) return primary;

  const { data: link } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("medicine_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
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
  disqualify_rules: Json;
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
      disqualifyRules: parseDisqualifyRules(q.disqualify_rules),
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
      "id, name, questionnaire_questions(id, prompt, description, question_type, is_required, sort_order, disqualify_rules, questionnaire_question_options(id, question_id, label, sort_order))",
    )
    .in("id", questionnaireIds)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "fetch_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
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
  const categoryPromise = getSessionCategory(sessionId);
  const [categoryLink, cartLines, packageResult, eligibilityResult, requiresQuestionnaire] =
    await Promise.all([
      categoryPromise,
      loadCheckoutCart(sessionId),
      session.selected_plan_id
        ? supabaseAdmin
            .from("packages")
            .select("id, name, duration_months, price, original_price, medicine_variants(name)")
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
      categoryPromise.then((link) =>
        link?.category_id ? categoryHasActiveQuestionnaire(link.category_id) : false,
      ),
    ]);

  const packageData = packageResult.data;
  const primaryLine = cartLines.find((line) => line.isPrimary) ?? cartLines[0] ?? null;
  const medicineId = primaryLine?.medicineId ?? null;
  const packageVariantName =
    (packageData as { medicine_variants?: { name: string } | null } | null)?.medicine_variants
      ?.name ?? null;
  const cartItems = cartLines.map((line) => {
    const isPrimaryLine =
      primaryLine != null &&
      line.medicineId === primaryLine.medicineId &&
      line.categoryId === primaryLine.categoryId;
    const { stripePriceId: _stripePriceId, durationMonths: _durationMonths, ...item } = line;
    if (!isPrimaryLine || !packageData) return item;
    return {
      ...item,
      packageId: packageData.id,
      packageName: packageData.name,
      packagePrice: Number(packageData.price),
      packageOriginalPrice: Number(packageData.original_price),
      variantName: packageVariantName ?? line.variantName,
    };
  });
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
    phoneCountryCode: session.phone_country_code,
    streetAddress: session.street_address,
    apartment: session.apartment,
    city: session.city,
    postalCode: digitsOnlyZip(session.postal_code ?? ""),
    billingSameAsShipping: session.billing_same_as_shipping,
    billingStreetAddress: session.billing_street_address,
    billingApartment: session.billing_apartment,
    billingCity: session.billing_city,
    billingStateCode: session.billing_state_code,
    billingPostalCode: digitsOnlyZip(session.billing_postal_code ?? ""),
    smsConsent: session.sms_consent,
    marketingConsent: session.marketing_consent,
    medicineId,
    medicineName: primaryLine?.medicineName ?? null,
    requiresQuestionnaire,
    selectedPackageId: session.selected_plan_id,
    packageName: packageData?.name ?? null,
    variantName: packageVariantName,
    packageDurationMonths: packageData?.duration_months ?? null,
    packagePrice: packageData?.price !== undefined ? Number(packageData.price) : null,
    packageOriginalPrice:
      packageData?.original_price !== undefined ? Number(packageData.original_price) : null,
    eligibilityResult: eligibility?.result ?? null,
    status: session.status,
    cartItems,
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

export async function getActiveCategories(): Promise<IntakeActionResult<CategoryDto[]>> {
  return fetchActiveCategories();
}

export async function getMedicinesForCategory(
  categorySlug: string,
): Promise<IntakeActionResult<MedicinesForCategoryDto>> {
  // Category lookup starts immediately; session is only needed when this goal has eligibility rules.
  const categoryPromise = supabaseAdmin
    .from("medication_categories")
    .select("id, name, eligibility_rules")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .maybeSingle();

  const { data: category, error: categoryError } = await categoryPromise;

  if (categoryError || !category) {
    return { ok: false, code: "not_found", message: "Category not found" };
  }

  const rules = parseEligibilityRules(category.eligibility_rules);
  const needsSession = categoryHasEligibilityRules(rules);

  // Links + optional session in parallel (session was previously sequential and slowed the page).
  const [linksResult, sessionResult] = await Promise.all([
    supabaseAdmin
      .from("medication_category_medicines")
      .select("sort_order, medicine_id")
      .eq("category_id", category.id)
      .order("sort_order", { ascending: true }),
    needsSession ? requireIntakeSession() : Promise.resolve(null),
  ]);

  if (linksResult.error) {
    return {
      ok: false,
      code: "fetch_error",
      message: userFacingMessage(
        linksResult.error.message,
        "We couldn't load this. Please refresh and try again.",
      ),
    };
  }

  const links = linksResult.data ?? [];
  const session = sessionResult && "session" in sessionResult ? sessionResult.session : null;

  const categoryEligibility =
    needsSession && session !== null
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

  const medicineIds = links.map((l) => l.medicine_id);
  if (medicineIds.length === 0) {
    return {
      ok: true,
      data: { medicines: [], categoryEligible: true, ineligibleReason: null },
    };
  }

  const [{ data: meds, error: medsError }, { data: variantRows }] = await Promise.all([
    supabaseAdmin
      .from("medicines")
      .select(
        "id, name, short_description, long_description, image_url, from_price_cents, important_info, notice_text, is_active, status, sort_order",
      )
      .in("id", medicineIds),
    supabaseAdmin
      .from("medicine_variants")
      .select("id, medicine_id, name, from_price_cents")
      .in("medicine_id", medicineIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (medsError) {
    return {
      ok: false,
      code: "fetch_error",
      message: userFacingMessage(
        medsError.message,
        "We couldn't load treatments. Please refresh and try again.",
      ),
    };
  }

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

  for (const link of links) {
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
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
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
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
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
  stateCode: z
    .string()
    .trim()
    .refine((value) => isUsStateCode(value), "Select your state"),
  sex: z.enum(["male", "female", "other"], { error: "Select your sex" }),
  dob: DOB_SCHEMA,
});

export async function saveIntakeDemographics(
  input: z.infer<typeof demographicsSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
  }

  const parsed = demographicsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Please complete the required fields",
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
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

const bmiSchema = z.object({
  heightFeet: z
    .number()
    .min(1, "Enter a valid height in feet")
    .max(8, "Enter a valid height in feet"),
  heightInches: z
    .number()
    .min(0, "Enter inches between 0 and 11")
    .max(11, "Enter inches between 0 and 11"),
  weightLbs: z.number().positive("Enter a valid weight").max(1500, "Enter a valid weight"),
});

export async function saveIntakeBmi(
  input: z.infer<typeof bmiSchema>,
): Promise<IntakeActionResult<{ bmi: number; eligibility: EligibilityResultDto }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
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
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
  }

  const eligibility = await evaluateEligibilityForSession(
    {
      ...sessionResult.session,
      height_cm: heightCm,
      weight_kg: weightKg,
    },
    null,
  );

  return { ok: true, data: { bmi, eligibility } };
}

export async function saveIntakeMedicine(
  medicineId: string,
  categorySlug?: string | null,
  variantId?: string | null,
): Promise<IntakeActionResult<{ medicineId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
  }

  // Goal page also navigates before saveIntakeCategory finishes. Recover from that race when
  // the client still knows which goal was selected.
  let categoryLink = await getSessionCategory(sessionResult.session.id);
  if (!categoryLink?.category_id && categorySlug) {
    const ensured = await saveIntakeCategory(categorySlug);
    if (!ensured.ok) return ensured;
    categoryLink = await getSessionCategory(sessionResult.session.id);
  }
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

  await supabaseAdmin
    .from("intake_session_medicines")
    .update({ is_primary: false })
    .eq("session_id", sessionResult.session.id)
    .neq("category_id", categoryLink.category_id);

  const { error } = await supabaseAdmin.from("intake_session_medicines").upsert(
    {
      session_id: sessionResult.session.id,
      category_id: categoryLink.category_id,
      medicine_id: medicineId,
      is_primary: true,
      ...(variantId !== undefined ? { variant_id: variantId } : {}),
    },
    { onConflict: "session_id,category_id" },
  );

  if (error) {
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
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
  fullName: z.string().trim().min(1, "Enter your full name").max(120, "Enter a shorter name"),
  email: z.string().trim().email("Enter a valid email").max(255, "Enter a valid email"),
  // Phone is collected on delivery-address; omit it from this step entirely.
  phone: OPTIONAL_PHONE_SCHEMA.optional(),
});

export async function saveIntakeContact(
  input: z.infer<typeof contactSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
  }

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Please complete the required fields",
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
      // Only write phone when the caller actually provided one (delivery-address owns this field).
      ...(data.phone !== undefined ? { phone: data.phone || "" } : {}),
    })
    .eq("id", sessionResult.session.id);

  if (error) {
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

const addressSchema = z
  .object({
    streetAddress: z
      .string()
      .trim()
      .min(1, "Enter your address")
      .max(255, "Enter a shorter address"),
    apartment: z.string().trim().max(60, "Enter a shorter apartment number"),
    city: z.string().trim().min(1, "Enter your city").max(120, "Enter a shorter city"),
    postalCode: ZIP_CODE_SCHEMA,
    phone: z.string().trim(),
    phoneCountryCode: PHONE_COUNTRY_CODE_SCHEMA,
    billingSameAsShipping: z.boolean(),
    billingStreetAddress: z
      .string()
      .trim()
      .max(255, "Enter a shorter billing address")
      .optional()
      .or(z.literal("")),
    billingApartment: z
      .string()
      .trim()
      .max(60, "Enter a shorter apartment number")
      .optional()
      .or(z.literal("")),
    billingCity: z.string().trim().max(120, "Enter a shorter city").optional().or(z.literal("")),
    billingStateCode: z
      .string()
      .trim()
      .max(2, "Select your billing state")
      .optional()
      .or(z.literal("")),
    billingPostalCode: OPTIONAL_ZIP_CODE_SCHEMA,
    smsConsent: z.boolean(),
    marketingConsent: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!isValidNationalPhone(data.phone, data.phoneCountryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Enter a valid phone number",
      });
    }
    if (!data.smsConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smsConsent"],
        message: "Please consent to SMS communications to continue",
      });
    }
    if (data.billingSameAsShipping) return;
    const required: [keyof typeof data, string][] = [
      ["billingStreetAddress", "Enter your billing address"],
      ["billingCity", "Enter your billing city"],
      ["billingPostalCode", "Enter a billing ZIP code of up to 6 digits"],
    ];
    for (const [key, message] of required) {
      if (!String(data[key] ?? "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message });
      }
    }
    if (!isUsStateCode(data.billingStateCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billingStateCode"],
        message: "Select your billing state",
      });
    }
  });

export async function saveIntakeAddress(
  input: z.infer<typeof addressSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
  }

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Please complete the required fields",
    };
  }
  const data = parsed.data;
  const same = data.billingSameAsShipping;

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({
      street_address: data.streetAddress,
      apartment: data.apartment || null,
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
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

export async function getQuestionnaireForCategory(
  categorySlug: string,
): Promise<IntakeActionResult<QuestionnaireDto | null>> {
  const { data: category, error: categoryError } = await supabaseAdmin
    .from("medication_categories")
    .select("id, name")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError) {
    return {
      ok: false,
      code: "fetch_error",
      message: userFacingMessage(
        categoryError.message,
        "We couldn't load this. Please refresh and try again.",
      ),
    };
  }
  if (!category) {
    return { ok: true, data: null };
  }

  const { data: questionnaireLinks, error: questionnaireLinkError } = await supabaseAdmin
    .from("questionnaire_categories")
    .select("questionnaire_id")
    .eq("category_id", category.id);

  if (questionnaireLinkError) {
    return {
      ok: false,
      code: "fetch_error",
      message: userFacingMessage(
        questionnaireLinkError.message,
        "We couldn't load the questionnaire. Please refresh and try again.",
      ),
    };
  }

  const questionnaireIds = (questionnaireLinks ?? []).map((l) => l.questionnaire_id);
  if (questionnaireIds.length === 0) {
    return { ok: true, data: null };
  }

  const loaded = await loadQuestionnaireDto(questionnaireIds);
  if (!loaded.ok || !loaded.data) return loaded;

  const categoryName = category.name.trim();
  return {
    ok: true,
    data: {
      ...loaded.data,
      title: categoryName ? `${categoryName} Medication Eligibility` : loaded.data.title,
    },
  };
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
    return {
      ok: false,
      code: "fetch_error",
      message: userFacingMessage(
        categoryError.message,
        "We couldn't load this. Please refresh and try again.",
      ),
    };
  }
  if (!category) {
    return { ok: true, data: false };
  }

  return { ok: true, data: await categoryHasActiveQuestionnaire(category.id) };
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
): Promise<IntakeActionResult<{ saved: number; eligibility: EligibilityResultDto }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
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
    const eligibility = await evaluateEligibilityForSession(sessionResult.session, medicineId);
    return { ok: true, data: { saved: 0, eligibility } };
  }

  const { error } = await supabaseAdmin.from("intake_session_questionnaire_responses").insert(rows);

  if (error) {
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
  }

  const eligibility = await evaluateEligibilityForSession(sessionResult.session, medicineId);
  return { ok: true, data: { saved: rows.length, eligibility } };
}

/**
 * Evaluate eligibility for the current session.
 * Pass `medicineId: null` for goal-level evaluation before medicine selection.
 * Responses are loaded session-wide (goal-level questionnaire).
 */
async function evaluateEligibilityForSession(
  session: IntakeSessionRow,
  medicineId: string | null,
): Promise<EligibilityResultDto> {
  const [categoryLink, responsesResult] = await Promise.all([
    getSessionCategory(session.id),
    supabaseAdmin
      .from("intake_session_questionnaire_responses")
      .select("question_id, answer_option_ids, answer_boolean, answer_text, answer_number")
      .eq("session_id", session.id),
  ]);

  const rules = parseEligibilityRules(categoryLink?.medication_categories?.eligibility_rules ?? {});
  const categoryResult = evaluateCategoryRules(session, rules);
  const responses = responsesResult.data ?? [];

  let questionnaireResult: EligibilityResultDto = { result: "eligible", reason: null };

  if (hasQuestionnaireResponses(responses)) {
    const optionIds = responses.flatMap((r) => r.answer_option_ids);
    const questionIds = [...new Set(responses.map((r) => r.question_id))];

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
      responses,
      optionsResult.data ?? [],
      questionsResult.data ?? [],
    );
  }

  const finalResult = combineEligibilityResults([categoryResult, questionnaireResult]);

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

  return finalResult;
}

export async function evaluateMedicineEligibility(
  medicineId: string | null = null,
): Promise<IntakeActionResult<EligibilityResultDto>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
  }

  const data = await evaluateEligibilityForSession(sessionResult.session, medicineId);
  return { ok: true, data };
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
    .select(
      "id, name, duration_months, original_price, price, is_most_popular, features, clinical_note, variant_id",
    )
    .eq("medicine_id", medicineId)
    .eq("is_active", true)
    .not("stripe_price_id", "is", null)
    .order("duration_months", { ascending: true });
  // Packages belong to a variant when one is chosen, otherwise to the medicine directly.
  query = variantId ? query.eq("variant_id", variantId) : query.is("variant_id", null);
  let { data, error } = await query;

  // Tirzepatide and similar medicines only have variant plans. A null variant
  // would otherwise leave Select Your Plan with nothing to choose and Continue disabled.
  if (!error && (data ?? []).length === 0) {
    const { data: variantPlans, error: variantError } = await supabaseAdmin
      .from("packages")
      .select(
        "id, name, duration_months, original_price, price, is_most_popular, features, clinical_note, variant_id",
      )
      .eq("medicine_id", medicineId)
      .eq("is_active", true)
      .not("stripe_price_id", "is", null)
      .order("duration_months", { ascending: true });

    if (variantError) {
      error = variantError;
    } else if (variantPlans?.length) {
      const { data: variants } = await supabaseAdmin
        .from("medicine_variants")
        .select("id, from_price_cents")
        .eq("medicine_id", medicineId)
        .eq("is_active", true)
        .order("from_price_cents", { ascending: true });

      const preferredId =
        [...(variants ?? [])]
          .sort(
            (a, b) =>
              (a.from_price_cents ?? Number.POSITIVE_INFINITY) -
              (b.from_price_cents ?? Number.POSITIVE_INFINITY),
          )
          .find((variant) => variantPlans.some((pkg) => pkg.variant_id === variant.id))?.id ??
        variantPlans.find((pkg) => pkg.variant_id)?.variant_id;
      data = preferredId
        ? variantPlans.filter((pkg) => pkg.variant_id === preferredId)
        : variantPlans;
    }
  }

  if (error) {
    return {
      ok: false,
      code: "fetch_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
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
  medicineId?: string | null,
  categorySlug?: string | null,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return {
      ok: false,
      code: "session_error",
      message: userFacingMessage(sessionResult.error, "Your session expired. Please start again."),
    };
  }

  // Goal/medications pages navigate before their saves finish. If the patient continues
  // quickly on the plan page, ensure goal + medicine links exist before validating.
  let medicineLink = await getSessionMedicineLink(sessionResult.session.id);
  if (!medicineLink?.medicine_id && medicineId) {
    const ensured = await saveIntakeMedicine(medicineId, categorySlug);
    if (!ensured.ok) return ensured;
    medicineLink = await getSessionMedicineLink(sessionResult.session.id);
  }
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
    return {
      ok: false,
      code: "save_error",
      message: userFacingMessage(error.message, "We couldn't complete that. Please try again."),
    };
  }

  await supabaseAdmin
    .from("intake_session_medicines")
    .update({ package_id: packageId, is_primary: true })
    .eq("session_id", sessionResult.session.id)
    .eq("medicine_id", medicineLink.medicine_id);

  return { ok: true, data: { sessionId: sessionResult.session.id } };
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

function formatOrderDate(iso: string): string {
  return formatPortalDate(iso);
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
    packageOriginalPrice: number | null;
    totalPaid: number | null;
    email: string | null;
    consultationFeeCents: number;
    renewalShippingCents: number;
    passwordSet: boolean;
    items: Array<{ name: string; planLabel: string; price: number | null }>;
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
      .select("id, amount_cents, created_at, status")
      .eq("session_id", session.id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("medication_requests")
      .select("id, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
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

  const payments = paymentResult.data ?? [];
  // Add-on plans are trialing subscriptions. Their first invoice is $0 and is recorded
  // after the real charge, so the newest payment is not the amount the patient paid.
  const charged = payments.find((row) => (row.amount_cents ?? 0) > 0);
  const request = requestResult.data;
  const paidCents = charged ? charged.amount_cents : payments.length > 0 ? 0 : null;
  const items = (summary.cartItems ?? [])
    .filter((item) => item.packagePrice != null || item.isPrimary)
    .map((item) => ({
      name: item.variantName ? `${item.medicineName} — ${item.variantName}` : item.medicineName,
      planLabel: item.packageName ?? item.categoryName,
      price: item.packagePrice,
    }));
  const pricedItems = items.filter((item) => item.price != null);
  const cartTotal =
    pricedItems.length > 0
      ? pricedItems.reduce((sum, item) => sum + (item.price ?? 0), 0)
      : summary.packagePrice;
  const cartOriginal =
    (summary.cartItems ?? []).length > 0
      ? (summary.cartItems ?? []).reduce(
          (sum, item) => sum + (item.packageOriginalPrice ?? item.packagePrice ?? 0),
          0,
        )
      : summary.packageOriginalPrice;
  const totalPaid =
    paidCents != null ? Number(paidCents) / 100 : cartTotal != null ? Number(cartTotal) : null;
  const joinedName = items
    .map((item) => item.name)
    .filter(Boolean)
    .join(", ");

  return {
    ok: true,
    data: {
      orderNumber: formatOrderId(request?.id ?? session.id),
      orderDate: formatOrderDate(request?.created_at ?? session.updated_at ?? session.created_at),
      medicineName: joinedName || summary.medicineName,
      variantName: items.length > 1 ? null : summary.variantName,
      packageName: items.length > 1 ? "One checkout" : summary.packageName,
      packagePrice: cartTotal != null ? Number(cartTotal) : summary.packagePrice,
      packageOriginalPrice:
        cartOriginal != null ? Number(cartOriginal) : summary.packageOriginalPrice,
      items,
      totalPaid,
      email: summary.email?.trim() || null,
      consultationFeeCents: fees.consultationFeeCents,
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

  await supabaseAdmin
    .from("patient_feedback")
    .update({ user_id: userId })
    .eq("intake_session_id", session.id)
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
