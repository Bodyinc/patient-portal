import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CategoryDto, IntakeActionResult } from "@/lib/intake/types";

function resolveCategoryImageSrc(
  categoryImageUrl: string | null | undefined,
  icon: string | null | undefined,
  medicineImageUrl: string | null | undefined,
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

  const medicineTrimmed = medicineImageUrl?.trim();
  return medicineTrimmed || null;
}

async function loadActiveCategories(): Promise<CategoryDto[]> {
  const { data, error } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name, tagline, description, icon, image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const categories = data ?? [];
  const needsMedicineFallback = categories.filter(
    (row) => !resolveCategoryImageSrc(row.image_url, row.icon, null),
  );
  const firstMedicineImageByCategory = new Map<string, string | null>();

  if (needsMedicineFallback.length > 0) {
    const categoryIds = needsMedicineFallback.map((row) => row.id);
    const { data: links } = await supabaseAdmin
      .from("medication_category_medicines")
      .select("category_id, medicine_id, sort_order")
      .in("category_id", categoryIds)
      .order("sort_order", { ascending: true });

    const medicineIds = [...new Set((links ?? []).map((link) => link.medicine_id))];
    const imageByMedicineId = new Map<string, string | null>();

    if (medicineIds.length > 0) {
      const { data: medicines } = await supabaseAdmin
        .from("medicines")
        .select("id, image_url")
        .in("id", medicineIds);

      for (const medicine of medicines ?? []) {
        imageByMedicineId.set(medicine.id, medicine.image_url);
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

  return categories.map((row) => ({
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
  }));
}

const getCachedActiveCategories = unstable_cache(
  loadActiveCategories,
  ["intake-active-categories"],
  {
    revalidate: 300,
    tags: ["intake-categories"],
  },
);

export const fetchActiveCategories = cache(async (): Promise<IntakeActionResult<CategoryDto[]>> => {
  try {
    return { ok: true, data: await getCachedActiveCategories() };
  } catch (error) {
    return {
      ok: false,
      code: "fetch_error",
      message: error instanceof Error ? error.message : "Unable to load goals.",
    };
  }
});
