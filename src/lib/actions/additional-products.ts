"use server";

import { z } from "zod";

import { saveIntakeMedicine } from "@/lib/actions/intake";
import { evaluateCategoryRules, type CategoryEligibilityRules } from "@/lib/intake/eligibility";
import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { requireIntakeSession } from "@/lib/intake/session";
import type {
  AddonGoalDto,
  AddonProductDto,
  IntakeActionResult,
  PackageDto,
} from "@/lib/intake/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { userFacingMessage } from "@/lib/user-message";
import type { Json } from "@/lib/supabase/types";

function parseFeatures(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseRules(value: Json): CategoryEligibilityRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CategoryEligibilityRules;
}

function isVisible(medicine: { is_active: boolean; status: string }) {
  return medicine.is_active && (medicine.status === "active" || medicine.status === "published");
}

const saveSchema = z.object({
  items: z
    .array(
      z.object({
        categorySlug: z.string().trim().min(1),
        medicineId: z.string().uuid(),
        packageId: z.string().uuid(),
        variantId: z.string().uuid().nullable(),
      }),
    )
    .max(12),
  primaryMedicineId: z.string().uuid().optional(),
  primaryCategorySlug: z.string().trim().min(1).optional(),
  primaryVariantId: z.string().uuid().nullable().optional(),
});

const BLOCKED_RELATIONSHIPS = new Set(["incompatible", "restricted", "contraindicated"]);

async function loadBlockedMedicineIds(medicineId: string) {
  const { data, error } = await supabaseAdmin
    .from("medication_relationships")
    .select("medicine_a_id, medicine_b_id, relationship")
    .or(`medicine_a_id.eq.${medicineId},medicine_b_id.eq.${medicineId}`);

  if (error) {
    return {
      ok: false as const,
      message: userFacingMessage(
        error.message,
        "We couldn't load extra treatments. Please try again.",
      ),
    };
  }

  const blocked = new Set<string>();
  for (const row of data ?? []) {
    if (!BLOCKED_RELATIONSHIPS.has(String(row.relationship))) continue;
    const other = row.medicine_a_id === medicineId ? row.medicine_b_id : row.medicine_a_id;
    if (other && other !== medicineId) blocked.add(other);
  }
  return { ok: true as const, blocked };
}

async function loadPrimaryMedicineId(sessionId: string, primaryCategoryId: string) {
  const withPrimary = await supabaseAdmin
    .from("intake_session_medicines")
    .select("medicine_id, category_id, is_primary")
    .eq("session_id", sessionId);

  if (!withPrimary.error) {
    const rows = withPrimary.data ?? [];
    const match =
      rows.find((row) => row.is_primary && row.category_id === primaryCategoryId) ??
      rows.find((row) => row.is_primary) ??
      rows.find((row) => row.category_id === primaryCategoryId);
    return { ok: true as const, medicineId: match?.medicine_id ?? null };
  }

  if (!withPrimary.error.message.includes("is_primary")) {
    return {
      ok: false as const,
      message: userFacingMessage(
        withPrimary.error.message,
        "We couldn't load extra treatments. Please try again.",
      ),
    };
  }

  const fallback = await supabaseAdmin
    .from("intake_session_medicines")
    .select("medicine_id, category_id")
    .eq("session_id", sessionId);
  if (fallback.error) {
    return {
      ok: false as const,
      message: userFacingMessage(
        fallback.error.message,
        "We couldn't load extra treatments. Please try again.",
      ),
    };
  }

  const match = (fallback.data ?? []).find((row) => row.category_id === primaryCategoryId);
  return { ok: true as const, medicineId: match?.medicine_id ?? null };
}

export async function getAdditionalProductOptions(
  primaryCategorySlug: string,
): Promise<IntakeActionResult<AddonGoalDto[]>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const { data: primaryCategory, error: primaryError } = await supabaseAdmin
    .from("medication_categories")
    .select("id")
    .eq("slug", primaryCategorySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (primaryError) return { ok: false, code: "fetch_error", message: primaryError.message };
  if (!primaryCategory) return { ok: true, data: [] };

  const primaryMedicine = await loadPrimaryMedicineId(sessionResult.session.id, primaryCategory.id);
  if (!primaryMedicine.ok)
    return { ok: false, code: "fetch_error", message: primaryMedicine.message };

  const blocked = primaryMedicine.medicineId
    ? await loadBlockedMedicineIds(primaryMedicine.medicineId)
    : { ok: true as const, blocked: new Set<string>() };
  if (!blocked.ok) return { ok: false, code: "fetch_error", message: blocked.message };

  const { data: categories, error: categoryError } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name, tagline, icon, image_url, eligibility_rules, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (categoryError) return { ok: false, code: "fetch_error", message: categoryError.message };

  const eligibleCategories = (categories ?? []).filter((category) => {
    if (category.id === primaryCategory.id) return false;
    const decision = evaluateCategoryRules(
      sessionResult.session,
      parseRules(category.eligibility_rules),
    );
    return decision.result !== "ineligible";
  });

  if (eligibleCategories.length === 0) return { ok: true, data: [] };

  const categoryIds = eligibleCategories.map((category) => category.id);
  const { data: links, error: linkError } = await supabaseAdmin
    .from("medication_category_medicines")
    .select("category_id, medicine_id, sort_order")
    .in("category_id", categoryIds)
    .order("sort_order", { ascending: true });

  if (linkError) return { ok: false, code: "fetch_error", message: linkError.message };

  const medicineIds = [...new Set((links ?? []).map((link) => link.medicine_id))];
  if (medicineIds.length === 0) return { ok: true, data: [] };

  const [{ data: medicines, error: medicineError }, { data: variants }, { data: packages }] =
    await Promise.all([
      supabaseAdmin
        .from("medicines")
        .select("id, name, short_description, image_url, from_price_cents, is_active, status")
        .in("id", medicineIds),
      supabaseAdmin
        .from("medicine_variants")
        .select("id, medicine_id, from_price_cents")
        .in("medicine_id", medicineIds)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("packages")
        .select(
          "id, medicine_id, variant_id, name, duration_months, original_price, price, is_most_popular, features, clinical_note",
        )
        .in("medicine_id", medicineIds)
        .eq("is_active", true)
        .not("stripe_price_id", "is", null)
        .order("duration_months", { ascending: true }),
    ]);

  if (medicineError) return { ok: false, code: "fetch_error", message: medicineError.message };

  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine]));
  const variantsByMedicine = new Map<string, { id: string; fromPriceCents: number | null }[]>();
  for (const variant of variants ?? []) {
    const list = variantsByMedicine.get(variant.medicine_id) ?? [];
    list.push({
      id: variant.id,
      fromPriceCents: variant.from_price_cents == null ? null : Number(variant.from_price_cents),
    });
    variantsByMedicine.set(variant.medicine_id, list);
  }

  const goals: AddonGoalDto[] = [];

  for (const category of eligibleCategories) {
    const products: AddonProductDto[] = [];
    const seen = new Set<string>();
    for (const link of links ?? []) {
      if (link.category_id !== category.id || seen.has(link.medicine_id)) continue;
      const medicine = medicineById.get(link.medicine_id);
      if (!medicine || !isVisible(medicine) || blocked.blocked.has(medicine.id)) continue;
      seen.add(link.medicine_id);

      const variantList = variantsByMedicine.get(medicine.id) ?? [];
      const defaultVariant = variantList.length
        ? [...variantList].sort(
            (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
          )[0]
        : null;

      const medicinePackages: PackageDto[] = (packages ?? [])
        .filter((pkg) => {
          if (pkg.medicine_id !== medicine.id) return false;
          return defaultVariant ? pkg.variant_id === defaultVariant.id : pkg.variant_id == null;
        })
        .map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          durationMonths: pkg.duration_months,
          originalPrice: Number(pkg.original_price),
          price: Number(pkg.price),
          isMostPopular: pkg.is_most_popular,
          features: parseFeatures(pkg.features),
          clinicalNote: pkg.clinical_note,
        }));

      if (medicinePackages.length === 0) continue;

      products.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        description: medicine.short_description,
        imageSrc: resolveMedicineImageSrc(medicine.image_url),
        fromPriceCents:
          medicine.from_price_cents == null ? null : Number(medicine.from_price_cents),
        variantId: defaultVariant?.id ?? null,
        packages: medicinePackages,
      });
    }

    if (products.length === 0) continue;

    const image = category.image_url?.trim() || category.icon?.trim() || null;
    goals.push({
      categorySlug: category.slug,
      categoryName: category.name,
      tagline: category.tagline,
      imageSrc: image && (image.startsWith("http") || image.startsWith("/")) ? image : null,
      products,
    });
  }

  return { ok: true, data: goals };
}

export async function saveAdditionalProducts(input: {
  items: Array<{
    categorySlug: string;
    medicineId: string;
    packageId: string;
    variantId: string | null;
  }>;
  primaryMedicineId?: string;
  primaryCategorySlug?: string;
  primaryVariantId?: string | null;
}): Promise<IntakeActionResult<{ saved: number }>> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Choose a plan for each added product.",
    };
  }

  const sessionId = sessionResult.session.id;
  let { data: primary } = await supabaseAdmin
    .from("intake_session_medicines")
    .select("category_id")
    .eq("session_id", sessionId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!primary?.category_id) {
    const { data: earliest } = await supabaseAdmin
      .from("intake_session_medicines")
      .select("category_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (earliest?.category_id) {
      await supabaseAdmin
        .from("intake_session_medicines")
        .update({ is_primary: true })
        .eq("session_id", sessionId)
        .eq("category_id", earliest.category_id);
      primary = earliest;
    }
  }

  if (!primary?.category_id && parsed.data.primaryMedicineId) {
    const ensured = await saveIntakeMedicine(
      parsed.data.primaryMedicineId,
      parsed.data.primaryCategorySlug,
      parsed.data.primaryVariantId,
    );
    if (!ensured.ok) return ensured;
    const reloaded = await supabaseAdmin
      .from("intake_session_medicines")
      .select("category_id")
      .eq("session_id", sessionId)
      .eq("is_primary", true)
      .maybeSingle();
    primary = reloaded.data;
  }

  if (!primary?.category_id) {
    return { ok: false, code: "no_medicine", message: "Select your medication first." };
  }

  const primaryMedicine = await loadPrimaryMedicineId(sessionId, primary.category_id);
  if (!primaryMedicine.ok)
    return { ok: false, code: "fetch_error", message: primaryMedicine.message };
  if (!primaryMedicine.medicineId) {
    return { ok: false, code: "no_medicine", message: "Select your medication first." };
  }

  const blocked = await loadBlockedMedicineIds(primaryMedicine.medicineId);
  if (!blocked.ok) return { ok: false, code: "fetch_error", message: blocked.message };

  const slugs = [...new Set(parsed.data.items.map((item) => item.categorySlug))];
  const { data: categories } = slugs.length
    ? await supabaseAdmin
        .from("medication_categories")
        .select("id, slug")
        .in("slug", slugs)
        .eq("is_active", true)
    : { data: [] as { id: string; slug: string }[] };

  const categoryBySlug = new Map((categories ?? []).map((category) => [category.slug, category]));
  const rows: Array<{
    session_id: string;
    category_id: string;
    medicine_id: string;
    package_id: string;
    variant_id: string | null;
    is_primary: boolean;
  }> = [];

  for (const item of parsed.data.items) {
    const category = categoryBySlug.get(item.categorySlug);
    if (!category || category.id === primary.category_id) {
      return {
        ok: false,
        code: "invalid_input",
        message: "That goal can't be combined with your selected goal.",
      };
    }
    if (blocked.blocked.has(item.medicineId)) {
      return {
        ok: false,
        code: "invalid_input",
        message: "That product can't be combined with your medication.",
      };
    }
    if (rows.some((row) => row.category_id === category.id)) {
      return { ok: false, code: "invalid_input", message: "Each category can be added once." };
    }

    const { data: links } = await supabaseAdmin
      .from("medication_category_medicines")
      .select("medicine_id, sort_order")
      .eq("category_id", category.id)
      .order("sort_order", { ascending: true });

    const linkedIds = (links ?? []).map((link) => link.medicine_id);
    const { data: linkedMedicines } = linkedIds.length
      ? await supabaseAdmin.from("medicines").select("id, is_active, status").in("id", linkedIds)
      : { data: [] as { id: string; is_active: boolean; status: string }[] };

    const visible = new Set(
      (linkedMedicines ?? [])
        .filter((medicine) => isVisible(medicine))
        .map((medicine) => medicine.id),
    );
    if (!visible.has(item.medicineId)) {
      return {
        ok: false,
        code: "invalid_input",
        message: "That product is not available for this goal.",
      };
    }

    const { data: pkg } = await supabaseAdmin
      .from("packages")
      .select("id, medicine_id, variant_id, is_active, stripe_price_id")
      .eq("id", item.packageId)
      .maybeSingle();

    if (!pkg || !pkg.is_active || !pkg.stripe_price_id || pkg.medicine_id !== item.medicineId) {
      return { ok: false, code: "invalid_plan", message: "Choose an available plan." };
    }
    if ((pkg.variant_id ?? null) !== (item.variantId ?? null)) {
      return { ok: false, code: "invalid_plan", message: "That plan does not match the product." };
    }

    rows.push({
      session_id: sessionId,
      category_id: category.id,
      medicine_id: item.medicineId,
      package_id: item.packageId,
      variant_id: item.variantId,
      is_primary: false,
    });
  }

  const { error: deleteMedicinesError } = await supabaseAdmin
    .from("intake_session_medicines")
    .delete()
    .eq("session_id", sessionId)
    .eq("is_primary", false);
  if (deleteMedicinesError) {
    return { ok: false, code: "save_error", message: deleteMedicinesError.message };
  }

  const { error: deleteCategoriesError } = await supabaseAdmin
    .from("intake_session_categories")
    .delete()
    .eq("session_id", sessionId)
    .neq("category_id", primary.category_id);
  if (deleteCategoriesError) {
    return { ok: false, code: "save_error", message: deleteCategoriesError.message };
  }

  if (rows.length === 0) return { ok: true, data: { saved: 0 } };

  const [{ error: medicineError }, { error: categoryError }] = await Promise.all([
    supabaseAdmin.from("intake_session_medicines").insert(rows),
    supabaseAdmin.from("intake_session_categories").insert(
      rows.map((row) => ({
        session_id: sessionId,
        category_id: row.category_id,
      })),
    ),
  ]);

  if (medicineError || categoryError) {
    return {
      ok: false,
      code: "save_error",
      message: medicineError?.message ?? categoryError?.message ?? "Unable to save added products.",
    };
  }

  return { ok: true, data: { saved: rows.length } };
}
