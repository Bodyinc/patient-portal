import type { ShopSortOption } from "@/lib/shop/types";

export type ShopQueryState = {
  category?: string | null;
  sort: ShopSortOption;
  page: number;
  q?: string;
};

export function buildShopHref(state: ShopQueryState) {
  const params = new URLSearchParams();
  if (state.category) params.set("category", state.category);
  if (state.q) params.set("q", state.q);
  params.set("sort", state.sort);
  params.set("page", String(state.page));
  return `/shop?${params.toString()}`;
}
