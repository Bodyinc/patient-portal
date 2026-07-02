import { NextResponse } from "next/server";

import { getShopMedicines } from "@/lib/actions/shop";
import { getShopServiceMode, parseShopServiceMode } from "@/lib/shop/service-config";
import { fetchShopCatalogData } from "@/lib/shop/service-data";
import { toErrorResponse, toSuccessResponse } from "@/lib/shop/service-response";
import type { ShopSortOption } from "@/lib/shop/types";
import type {
  ShopCatalogPayload,
  ShopServiceMode,
  ShopServiceResponse,
} from "@/lib/shop/service-types";

export const dynamic = "force-dynamic";

function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  return response;
}

function parseSort(value: string | null): ShopSortOption {
  if (value === "price_asc") return "price_asc";
  if (value === "price_desc") return "price_desc";
  if (value === "name_asc") return "name_asc";
  return "popular";
}

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMode(request: Request): ShopServiceMode {
  const url = new URL(request.url);
  const explicit = url.searchParams.get("mode");
  return explicit ? parseShopServiceMode(explicit) : getShopServiceMode();
}

function getCorrelationId(request: Request) {
  return request.headers.get("x-correlation-id") ?? crypto.randomUUID();
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const mode = getMode(request);
  const correlationId = getCorrelationId(request);
  const url = new URL(request.url);

  const params = {
    categorySlug: url.searchParams.get("category"),
    sortBy: parseSort(url.searchParams.get("sort")),
    page: Math.max(1, parseNumber(url.searchParams.get("page"), 1)),
    pageSize: Math.max(1, Math.min(24, parseNumber(url.searchParams.get("pageSize"), 6))),
    searchQuery: (url.searchParams.get("q") ?? "").trim(),
  };

  try {
    if (mode === "legacy") {
      const legacy = await getShopMedicines(params);
      if (!legacy.ok) {
        const response = toErrorResponse<ShopCatalogPayload>({
          error: { code: legacy.code, message: legacy.message },
          correlationId,
          mode,
          startedAt,
        });
        return withCacheHeaders(
          NextResponse.json(response, { status: legacy.code === "not_found" ? 404 : 500 }),
        );
      }
      const success = toSuccessResponse({
        data: legacy.data,
        correlationId,
        mode,
        startedAt,
      });
      console.info("[shop-service][catalog]", {
        ...success.meta,
        page: params.page,
        categorySlug: params.categorySlug,
      });
      return withCacheHeaders(NextResponse.json(success));
    }

    const serviceData = await fetchShopCatalogData(params);

    if (mode === "dual") {
      const legacy = await getShopMedicines(params);
      if (!legacy.ok || JSON.stringify(legacy.data) !== JSON.stringify(serviceData)) {
        console.warn("[shop-service][dual][catalog] mismatch", {
          correlationId,
          legacyOk: legacy.ok,
          legacyCode: legacy.ok ? null : legacy.code,
          serviceCount: serviceData.items.length,
          legacyCount: legacy.ok ? legacy.data.items.length : null,
          categorySlug: params.categorySlug,
          sortBy: params.sortBy,
          page: params.page,
          searchQuery: params.searchQuery,
        });
      }
    }

    const response: ShopServiceResponse<ShopCatalogPayload> = toSuccessResponse({
      data: serviceData,
      correlationId,
      mode,
      startedAt,
    });
    console.info("[shop-service][catalog]", {
      ...response.meta,
      page: params.page,
      categorySlug: params.categorySlug,
    });
    return withCacheHeaders(NextResponse.json(response));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch catalog.";
    const isNotFound = message === "Category not found.";
    const response = toErrorResponse<ShopCatalogPayload>({
      error: {
        code: isNotFound ? "not_found" : "fetch_error",
        message,
      },
      correlationId,
      mode,
      startedAt,
    });
    return withCacheHeaders(NextResponse.json(response, { status: isNotFound ? 404 : 500 }));
  }
}
