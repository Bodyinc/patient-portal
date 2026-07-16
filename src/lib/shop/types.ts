export type ShopSortOption = "popular" | "price_asc" | "price_desc" | "name_asc";

export type ShopCategoryDto = {
  id: string;
  slug: string;
  name: string;
};

export type ShopMedicineVariantOption = {
  id: string;
  name: string;
  fromPriceCents: number | null;
};

export type ShopMedicineCardDto = {
  id: string;
  name: string;
  categoryName: string;
  description: string;
  imageSrc: string;
  fromPriceCents: number | null;
  // Empty when the medicine has no variants (buy the medicine directly).
  variants: ShopMedicineVariantOption[];
};

export type ShopMedicinesListDto = {
  items: ShopMedicineCardDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy: ShopSortOption;
  currentCategorySlug: string | null;
  searchQuery: string;
};
