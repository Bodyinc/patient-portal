import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { userFacingMessage } from "@/lib/user-message";
import { getShopServiceMode } from "@/lib/shop/service-config";
import { createShopCheckoutOrderData } from "@/lib/shop/service-data";
import { toErrorResponse, toSuccessResponse } from "@/lib/shop/service-response";
import type {
  ShopCheckoutOrderCreateInput,
  ShopCheckoutOrderPayload,
  ShopServiceResponse,
} from "@/lib/shop/service-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const mode = getShopServiceMode();
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const response = toErrorResponse<ShopCheckoutOrderPayload>({
      error: { code: "unauthorized", message: "Sign in to continue." },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 401 });
  }

  try {
    const input = (await request.json()) as ShopCheckoutOrderCreateInput;
    const data = await createShopCheckoutOrderData({ userId: user.id, input });
    const response: ShopServiceResponse<ShopCheckoutOrderPayload> = toSuccessResponse({
      data,
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const response = toErrorResponse<ShopCheckoutOrderPayload>({
      error: {
        code: "create_error",
        message: userFacingMessage(error, "We couldn't start your order. Please try again."),
      },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 500 });
  }
}
