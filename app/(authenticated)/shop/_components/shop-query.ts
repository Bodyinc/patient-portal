import type { ShopSortOption } from "@/lib/shop/types";

export type ShopQueryState = {
  category?: string | null;
  sort: ShopSortOption;
  q?: string;
};

export function buildShopHref(state: ShopQueryState) {
  const params = new URLSearchParams();
  if (state.category) params.set("category", state.category);
  if (state.q) params.set("q", state.q);
  params.set("sort", state.sort);
  return `/shop?${params.toString()}`;
}
