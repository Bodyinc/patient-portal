import type { ShopServiceError, ShopServiceMode, ShopServiceResponse } from "./service-types";

export function toSuccessResponse<T>({
  data,
  correlationId,
  mode,
  startedAt,
}: {
  data: T;
  correlationId: string;
  mode: ShopServiceMode;
  startedAt: number;
}): ShopServiceResponse<T> {
  return {
    ok: true,
    data,
    error: null,
    meta: {
      correlationId,
      mode,
      durationMs: Date.now() - startedAt,
    },
  };
}

export function toErrorResponse<T>({
  error,
  correlationId,
  mode,
  startedAt,
}: {
  error: ShopServiceError;
  correlationId: string;
  mode: ShopServiceMode;
  startedAt: number;
}): ShopServiceResponse<T> {
  return {
    ok: false,
    data: null,
    error,
    meta: {
      correlationId,
      mode,
      durationMs: Date.now() - startedAt,
    },
  };
}
