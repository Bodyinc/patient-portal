import { NextResponse } from "next/server";

import { getShopCategories } from "@/lib/actions/shop";
import { getShopServiceMode, parseShopServiceMode } from "@/lib/shop/service-config";
import { fetchShopCategoriesData } from "@/lib/shop/service-data";
import { toErrorResponse, toSuccessResponse } from "@/lib/shop/service-response";
import type {
  ShopCategoriesPayload,
  ShopServiceMode,
  ShopServiceResponse,
} from "@/lib/shop/service-types";

export const dynamic = "force-dynamic";

function withCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  return response;
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

  try {
    if (mode === "legacy") {
      const legacy = await getShopCategories();
      if (!legacy.ok) {
        const response = toErrorResponse<ShopCategoriesPayload>({
          error: { code: legacy.code, message: legacy.message },
          correlationId,
          mode,
          startedAt,
        });
        return withCacheHeaders(NextResponse.json(response, { status: 500 }));
      }
      const success = toSuccessResponse({
        data: legacy.data,
        correlationId,
        mode,
        startedAt,
      });
      console.info("[shop-service][categories]", success.meta);
      return withCacheHeaders(NextResponse.json(success));
    }

    const serviceData = await fetchShopCategoriesData();

    if (mode === "dual") {
      const legacy = await getShopCategories();
      if (!legacy.ok || JSON.stringify(legacy.data) !== JSON.stringify(serviceData)) {
        console.warn("[shop-service][dual][categories] mismatch", {
          correlationId,
          legacyOk: legacy.ok,
          legacyCode: legacy.ok ? null : legacy.code,
          serviceCount: serviceData.length,
          legacyCount: legacy.ok ? legacy.data.length : null,
        });
      }
    }

    const response: ShopServiceResponse<ShopCategoriesPayload> = toSuccessResponse({
      data: serviceData,
      correlationId,
      mode,
      startedAt,
    });
    console.info("[shop-service][categories]", response.meta);
    return withCacheHeaders(NextResponse.json(response));
  } catch (error) {
    const response = toErrorResponse<ShopCategoriesPayload>({
      error: {
        code: "fetch_error",
        message: error instanceof Error ? error.message : "Unable to fetch categories.",
      },
      correlationId,
      mode,
      startedAt,
    });
    return withCacheHeaders(NextResponse.json(response, { status: 500 }));
  }
}
