import type {
  ShopCatalogPayload,
  ShopCatalogQuery,
  ShopCategoriesPayload,
  ShopReferralSharePayload,
  ShopServiceMeta,
  ShopServiceResponse,
} from "./service-types";

function toQueryString(query?: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function getCorrelationId() {
  return crypto.randomUUID();
}

async function requestShopService<T>({
  path,
  method = "GET",
  body,
  baseUrl,
}: {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  baseUrl?: string;
}): Promise<{ data: T; meta: ShopServiceMeta }> {
  const correlationId = getCorrelationId();
  const response = await fetch(`${baseUrl ?? ""}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-correlation-id": correlationId,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json()) as ShopServiceResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return { data: payload.data, meta: payload.meta };
}

export async function getShopCategoriesFromService(options?: { baseUrl?: string }) {
  const payload = await requestShopService<ShopCategoriesPayload>({
    path: "/api/shop/categories",
    baseUrl: options?.baseUrl,
  });
  return payload.data;
}

export async function getShopCatalogFromService(
  query: ShopCatalogQuery,
  options?: { baseUrl?: string },
) {
  const path = `/api/shop/catalog${toQueryString({
    category: query.category,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
    q: query.q,
  })}`;
  const payload = await requestShopService<ShopCatalogPayload>({
    path,
    baseUrl: options?.baseUrl,
  });
  return payload.data;
}

export async function postShopReferralShare(
  input: ShopReferralSharePayload,
  options?: { baseUrl?: string },
) {
  const payload = await requestShopService<{ accepted: true }>({
    path: "/api/shop/referrals/share",
    method: "POST",
    body: input,
    baseUrl: options?.baseUrl,
  });
  return payload.data;
}
