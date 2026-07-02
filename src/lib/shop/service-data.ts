import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ShopCategoryDto, ShopMedicinesListDto, ShopSortOption } from "./types";

export async function fetchShopCategoriesData(): Promise<ShopCategoryDto[]> {
  const { data, error } = await supabaseAdmin
    .from("medication_categories")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
  }));
}

export async function fetchShopCatalogData(options: {
  categorySlug?: string | null;
  sortBy?: ShopSortOption;
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}): Promise<ShopMedicinesListDto> {
  const categorySlug = options.categorySlug ?? null;
  const sortBy = options.sortBy ?? "popular";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(24, options.pageSize ?? 6));
  const searchQuery = (options.searchQuery ?? "").trim();

  let filteredMedicineIds: string[] | null = null;
  let selectedCategoryName: string | null = null;

  if (categorySlug) {
    const { data: category, error: categoryError } = await supabaseAdmin
      .from("medication_categories")
      .select("id, name")
      .eq("slug", categorySlug)
      .eq("is_active", true)
      .maybeSingle();

    if (categoryError || !category) {
      throw new Error("Category not found.");
    }

    selectedCategoryName = category.name;

    const { data: links, error: linksError } = await supabaseAdmin
      .from("medication_category_medicines")
      .select("medicine_id")
      .eq("category_id", category.id);

    if (linksError) throw new Error(linksError.message);

    filteredMedicineIds = [...new Set((links ?? []).map((link) => link.medicine_id))];
    if (filteredMedicineIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        sortBy,
        currentCategorySlug: categorySlug,
        searchQuery,
      };
    }
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabaseAdmin
    .from("medicines")
    .select("id, name, short_description, image_url, price_monthly, sort_order", {
      count: "exact",
    })
    .eq("is_active", true)
    .eq("status", "active");

  if (filteredMedicineIds) query = query.in("id", filteredMedicineIds);
  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,short_description.ilike.%${searchQuery}%`);
  }

  if (sortBy === "price_asc") query = query.order("price_monthly", { ascending: true });
  if (sortBy === "price_desc") query = query.order("price_monthly", { ascending: false });
  if (sortBy === "name_asc") query = query.order("name", { ascending: true });
  if (sortBy === "popular") query = query.order("sort_order", { ascending: true });
  query = query.order("id", { ascending: true });

  const { data: medicines, error, count } = await query.range(start, end);
  if (error) throw new Error(error.message);

  const validMeds = medicines ?? [];
  const medicineIds = validMeds.map((medicine) => medicine.id);
  let categoryNameByMedicineId = new Map<string, string>();

  if (!selectedCategoryName && medicineIds.length > 0) {
    const { data: links } = await supabaseAdmin
      .from("medication_category_medicines")
      .select("medicine_id, category_id")
      .in("medicine_id", medicineIds);

    const categoryIds = [...new Set((links ?? []).map((link) => link.category_id))];
    if (categoryIds.length > 0) {
      const { data: categories } = await supabaseAdmin
        .from("medication_categories")
        .select("id, name")
        .in("id", categoryIds);

      const categoryMap = new Map(
        (categories ?? []).map((category) => [category.id, category.name]),
      );
      categoryNameByMedicineId = new Map(
        (links ?? [])
          .filter((link) => categoryMap.has(link.category_id))
          .map((link) => [link.medicine_id, categoryMap.get(link.category_id)!]),
      );
    }
  }

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items: validMeds.map((medicine) => ({
      id: medicine.id,
      name: medicine.name,
      categoryName: selectedCategoryName ?? categoryNameByMedicineId.get(medicine.id) ?? "Wellness",
      description: medicine.short_description,
      imageSrc: resolveMedicineImageSrc(medicine.image_url),
      priceMonthly: Number(medicine.price_monthly),
    })),
    total,
    page,
    pageSize,
    totalPages,
    sortBy,
    currentCategorySlug: categorySlug,
    searchQuery,
  };
}
