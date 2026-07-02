"use server";

import type { IntakeActionResult } from "@/lib/intake/types";
import { fetchShopCatalogData, fetchShopCategoriesData } from "@/lib/shop/service-data";
import type { ShopCategoryDto, ShopMedicinesListDto, ShopSortOption } from "@/lib/shop/types";

export async function getShopCategories(): Promise<IntakeActionResult<ShopCategoryDto[]>> {
  try {
    const data = await fetchShopCategoriesData();
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      code: "fetch_error",
      message: error instanceof Error ? error.message : "Unable to fetch shop categories.",
    };
  }
}

export async function getShopMedicines(options: {
  categorySlug?: string | null;
  sortBy?: ShopSortOption;
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}): Promise<IntakeActionResult<ShopMedicinesListDto>> {
  try {
    const data = await fetchShopCatalogData(options);
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch shop catalog.";
    return {
      ok: false,
      code: message === "Category not found." ? "not_found" : "fetch_error",
      message,
    };
  }
}
