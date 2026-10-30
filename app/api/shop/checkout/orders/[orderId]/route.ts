import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { userFacingMessage } from "@/lib/user-message";
import { getShopServiceMode } from "@/lib/shop/service-config";
import { getShopCheckoutOrderByIdData } from "@/lib/shop/service-data";
import { toErrorResponse, toSuccessResponse } from "@/lib/shop/service-response";
import type { ShopCheckoutOrderPayload, ShopServiceResponse } from "@/lib/shop/service-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const startedAt = Date.now();
  const mode = getShopServiceMode();
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const response = toErrorResponse<ShopCheckoutOrderPayload>({
      error: { code: "unauthorized", message: "Authentication required." },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 401 });
  }

  const { orderId } = await context.params;
  try {
    const data = await getShopCheckoutOrderByIdData({ userId: user.id, orderId });
    const response: ShopServiceResponse<ShopCheckoutOrderPayload> = toSuccessResponse({
      data,
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const response = toErrorResponse<ShopCheckoutOrderPayload>({
      error: {
        code: "not_found",
        message: userFacingMessage(error, "We couldn't find that order."),
      },
      correlationId,
      mode,
      startedAt,
    });
    return NextResponse.json(response, { status: 404 });
  }
}
