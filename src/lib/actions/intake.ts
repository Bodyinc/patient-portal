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
import type {
  CategoryDto,
  EligibilityResultDto,
  IntakeActionResult,
  IntakeSummaryDto,
  MedicineDto,
  MedicinesForCategoryDto,
  PackageDto,
  QuestionnaireDto,
  QuestionnaireResponseInput,
} from "@/lib/intake/types";
import { normalizeQuestionType } from "@/lib/intake/questionnaire";
import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const { data: link } = await supabaseAdmin
    .from("intake_session_categories")
    .select("category_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link?.category_id) return null;

  const { data: category } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name, eligibility_rules")
    .eq("id", link.category_id)
    .maybeSingle();

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

  const [categoryLink, medicineLink] = await Promise.all([
    getSessionCategory(sessionId),
    getSessionMedicineLink(sessionId),
  ]);

  const medicineId = medicineLink?.medicine_id ?? null;

  const [medicineResult, packageResult, eligibilityResult] = await Promise.all([
    medicineId
      ? supabaseAdmin
          .from("medicines")
          .select("id, name, requires_questionnaire")
          .eq("id", medicineId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    session.selected_plan_id
      ? supabaseAdmin
          .from("packages")
          .select("id, name, duration_months, price")
          .eq("id", session.selected_plan_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    medicineId
      ? supabaseAdmin
          .from("intake_session_eligibility_results")
          .select("result")
          .eq("session_id", sessionId)
          .eq("medicine_id", medicineId)
          .order("evaluated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const medicine = medicineResult.data;
  const packageData = packageResult.data;
  const eligibility = eligibilityResult.data;

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
    medicineId: medicine?.id ?? null,
    medicineName: medicine?.name ?? null,
    requiresQuestionnaire: medicine?.requires_questionnaire ?? false,
    selectedPackageId: session.selected_plan_id,
    packageName: packageData?.name ?? null,
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

export async function getActiveCategories(): Promise<IntakeActionResult<CategoryDto[]>> {
  const { data, error } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name, tagline, description, icon")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return { ok: false, code: "fetch_error", message: error.message };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      icon: row.icon,
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
      "id, name, short_description, long_description, image_url, price_monthly, important_info, notice_text, requires_questionnaire, is_active, status, sort_order",
    )
    .in("id", medicineIds);

  if (medsError) {
    return { ok: false, code: "fetch_error", message: medsError.message };
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
      priceMonthly: Number(med.price_monthly),
      requiresQuestionnaire: med.requires_questionnaire,
    });
  }

  return {
    ok: true,
    data: { medicines, categoryEligible: true, ineligibleReason: null },
  };
}

export async function saveIntakeCategory(
  categorySlug: string,
): Promise<IntakeActionResult<{ categoryId: string; goalName: string }>> {
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

  const { data: priorMedicineLinks } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("medicine_id")
    .eq("session_id", sessionId);

  const priorMedicineIds = (priorMedicineLinks ?? []).map((l) => l.medicine_id);

  await Promise.all([
    supabaseAdmin.from("intake_session_categories").delete().eq("session_id", sessionId),
    supabaseAdmin.from("intake_session_medicines").delete().eq("session_id", sessionId),
    priorMedicineIds.length > 0
      ? supabaseAdmin
          .from("intake_session_questionnaire_responses")
          .delete()
          .eq("session_id", sessionId)
          .in("medicine_id", priorMedicineIds)
      : Promise.resolve(),
    priorMedicineIds.length > 0
      ? supabaseAdmin
          .from("intake_session_eligibility_results")
          .delete()
          .eq("session_id", sessionId)
          .in("medicine_id", priorMedicineIds)
      : Promise.resolve(),
    supabaseAdmin.from("intake_sessions").update({ selected_plan_id: null }).eq("id", sessionId),
  ]);

  const { error } = await supabaseAdmin.from("intake_session_categories").insert({
    session_id: sessionId,
    category_id: category.id,
  });

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { categoryId: category.id, goalName: category.name } };
}

const demographicsSchema = z.object({
  stateCode: z.string().trim().min(2).max(2),
  sex: z.enum(["male", "female", "other"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function saveIntakeDemographics(
  input: z.infer<typeof demographicsSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const data = demographicsSchema.parse(input);

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
  heightFeet: z.number().min(0),
  heightInches: z.number().min(0).max(11),
  weightLbs: z.number().positive(),
});

export async function saveIntakeBmi(
  input: z.infer<typeof bmiSchema>,
): Promise<IntakeActionResult<{ bmi: number }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const data = bmiSchema.parse(input);
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
): Promise<IntakeActionResult<{ requiresQuestionnaire: boolean }>> {
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
    .select("id, requires_questionnaire, is_active, status")
    .eq("id", medicineId)
    .maybeSingle();

  if (medError || !medicine || !isMedicineCatalogVisible(medicine)) {
    return { ok: false, code: "not_found", message: "Medicine not found" };
  }

  await Promise.all([
    supabaseAdmin
      .from("intake_session_questionnaire_responses")
      .delete()
      .eq("session_id", sessionResult.session.id)
      .eq("medicine_id", medicineId),
    supabaseAdmin
      .from("intake_session_eligibility_results")
      .delete()
      .eq("session_id", sessionResult.session.id)
      .eq("medicine_id", medicineId),
    supabaseAdmin
      .from("intake_sessions")
      .update({ selected_plan_id: null })
      .eq("id", sessionResult.session.id),
  ]);

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

  return { ok: true, data: { requiresQuestionnaire: medicine.requires_questionnaire } };
}

const contactSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(32),
});

export async function saveIntakeContact(
  input: z.infer<typeof contactSchema>,
): Promise<IntakeActionResult<{ sessionId: string }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const data = contactSchema.parse(input);

  const { error } = await supabaseAdmin
    .from("intake_sessions")
    .update({
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
    })
    .eq("id", sessionResult.session.id);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { sessionId: sessionResult.session.id } };
}

export async function getQuestionnaireForMedicine(
  medicineId: string,
): Promise<IntakeActionResult<QuestionnaireDto | null>> {
  const { data: link, error: linkError } = await supabaseAdmin
    .from("questionnaire_medicines")
    .select("questionnaire_id")
    .eq("medicine_id", medicineId)
    .limit(1)
    .maybeSingle();

  if (linkError) {
    return { ok: false, code: "fetch_error", message: linkError.message };
  }

  if (!link?.questionnaire_id) {
    return { ok: true, data: null };
  }

  const { data: questionnaire, error: questionnaireError } = await supabaseAdmin
    .from("questionnaires")
    .select("id, name, description, is_active")
    .eq("id", link.questionnaire_id)
    .maybeSingle();

  if (questionnaireError) {
    return { ok: false, code: "fetch_error", message: questionnaireError.message };
  }

  if (!questionnaire || !questionnaire.is_active) {
    return { ok: true, data: null };
  }

  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("questionnaire_questions")
    .select("id, prompt, description, question_type, is_required, sort_order, disqualify_rules")
    .eq("questionnaire_id", questionnaire.id)
    .order("sort_order", { ascending: true });

  if (questionsError) {
    return { ok: false, code: "fetch_error", message: questionsError.message };
  }

  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: options, error: optionsError } = await supabaseAdmin
    .from("questionnaire_question_options")
    .select("id, question_id, label, sort_order")
    .in("question_id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order", { ascending: true });

  if (optionsError) {
    return { ok: false, code: "fetch_error", message: optionsError.message };
  }

  const optionsByQuestion = new Map<string, { id: string; label: string }[]>();
  for (const option of options ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push({ id: option.id, label: option.label });
    optionsByQuestion.set(option.question_id, list);
  }

  return {
    ok: true,
    data: {
      id: questionnaire.id,
      title: questionnaire.name,
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        text: q.prompt,
        description: q.description,
        questionType: normalizeQuestionType(q.question_type),
        isRequired: q.is_required,
        options: optionsByQuestion.get(q.id) ?? [],
      })),
    },
  };
}

export async function saveQuestionnaireResponses(
  medicineId: string,
  responses: QuestionnaireResponseInput[],
): Promise<IntakeActionResult<{ saved: number }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  await supabaseAdmin
    .from("intake_session_questionnaire_responses")
    .delete()
    .eq("session_id", sessionResult.session.id)
    .eq("medicine_id", medicineId);

  const rows = responses.map((response) => ({
    session_id: sessionResult.session.id,
    medicine_id: medicineId,
    question_id: response.questionId,
    answer_text: response.answerText ?? null,
    answer_number: response.answerNumber ?? null,
    answer_boolean: response.answerBoolean ?? null,
    answer_option_ids: response.optionIds ?? [],
  }));

  if (rows.length === 0) {
    return { ok: true, data: { saved: 0 } };
  }

  const { error } = await supabaseAdmin.from("intake_session_questionnaire_responses").insert(rows);

  if (error) {
    return { ok: false, code: "save_error", message: error.message };
  }

  return { ok: true, data: { saved: rows.length } };
}

export async function evaluateMedicineEligibility(
  medicineId: string,
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
    .eq("session_id", session.id)
    .eq("medicine_id", medicineId);

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
): Promise<IntakeActionResult<PackageDto[]>> {
  const { data, error } = await supabaseAdmin
    .from("packages")
    .select("*")
    .eq("medicine_id", medicineId)
    .eq("is_active", true)
    .order("duration_months", { ascending: true });

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
    .select("id, is_active, medicine_id")
    .eq("id", packageId)
    .maybeSingle();

  if (pkgError || !pkg || !pkg.is_active) {
    return { ok: false, code: "not_found", message: "Plan not found" };
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
    .select("medicine_id, is_active")
    .eq("id", summary.selectedPackageId)
    .maybeSingle();

  if (!pkg?.is_active || pkg.medicine_id !== summary.medicineId) {
    return { ok: false, code: "invalid_plan", message: "Selected plan is not valid" };
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

export async function claimIntakeSession(userId: string): Promise<void> {
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
    })
    .eq("id", userId);
}
