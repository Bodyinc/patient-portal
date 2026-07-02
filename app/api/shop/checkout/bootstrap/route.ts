import { NextResponse } from "next/server";

import { getShopServiceMode } from "@/lib/shop/service-config";
import { fetchShopCheckoutBootstrapData } from "@/lib/shop/service-data";
import { toErrorResponse, toSuccessResponse } from "@/lib/shop/service-response";
import type { ShopCheckoutBootstrapPayload, ShopServiceResponse } from "@/lib/shop/service-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const mode = getShopServiceMode();
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const url = new URL(request.url);
  const medicineId = url.searchParams.get("medicineId");

  if (!medicineId) {
    const response = toErrorResponse<ShopCheckoutBootstrapPayload>({
      error: { code: "validation_error", message: "medicineId is required." },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 400 });
  }

  try {
    const data = await fetchShopCheckoutBootstrapData({ medicineId });
    const response: ShopServiceResponse<ShopCheckoutBootstrapPayload> = toSuccessResponse({
      data,
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const response = toErrorResponse<ShopCheckoutBootstrapPayload>({
      error: {
        code: "fetch_error",
        message: error instanceof Error ? error.message : "Unable to load checkout data.",
      },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 500 });
  }
}
