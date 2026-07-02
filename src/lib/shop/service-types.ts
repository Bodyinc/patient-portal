import type { ShopCategoryDto, ShopMedicinesListDto, ShopSortOption } from "./types";

export type ShopServiceMode = "legacy" | "dual" | "service";

export type ShopServiceError = {
  code: string;
  message: string;
};

export type ShopServiceMeta = {
  correlationId: string;
  mode: ShopServiceMode;
  durationMs: number;
};

export type ShopServiceResponse<T> =
  | { ok: true; data: T; error: null; meta: ShopServiceMeta }
  | { ok: false; data: null; error: ShopServiceError; meta: ShopServiceMeta };

export type ShopCatalogQuery = {
  category?: string | null;
  sort?: ShopSortOption;
  page?: number;
  pageSize?: number;
  q?: string;
};

export type ShopCategoriesPayload = ShopCategoryDto[];
export type ShopCatalogPayload = ShopMedicinesListDto;

export type ShopReferralSharePayload = {
  referralCode: string;
  channel: "whatsapp" | "x" | "email" | "copy" | "other";
};
