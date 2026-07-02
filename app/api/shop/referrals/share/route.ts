import { NextResponse } from "next/server";

import { getShopServiceMode } from "@/lib/shop/service-config";
import { toErrorResponse, toSuccessResponse } from "@/lib/shop/service-response";
import type { ShopReferralSharePayload, ShopServiceResponse } from "@/lib/shop/service-types";

type ShopReferralShareResult = {
  accepted: true;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const mode = getShopServiceMode();
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

  try {
    const body = (await request.json()) as Partial<ShopReferralSharePayload>;
    const referralCode = body.referralCode?.trim();

    if (!referralCode) {
      const response = toErrorResponse<ShopReferralShareResult>({
        error: { code: "validation_error", message: "Referral code is required." },
        correlationId,
        mode,
        startedAt,
      });
      return NextResponse.json(response, { status: 400 });
    }

    console.info("[shop-service][referrals][share]", {
      correlationId,
      channel: body.channel ?? "other",
      referralCode,
      mode,
    });

    const response: ShopServiceResponse<ShopReferralShareResult> = toSuccessResponse({
      data: { accepted: true },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 202 });
  } catch {
    const response = toErrorResponse<ShopReferralShareResult>({
      error: { code: "invalid_payload", message: "Invalid referral payload." },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 400 });
  }
}
