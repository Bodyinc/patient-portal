import type { ShopServiceMode } from "./service-types";

const DEFAULT_MODE: ShopServiceMode = "service";

export function parseShopServiceMode(value: string | null | undefined): ShopServiceMode {
  if (value === "legacy") return "legacy";
  if (value === "dual") return "dual";
  if (value === "service") return "service";
  return DEFAULT_MODE;
}

export function getShopServiceMode() {
  return parseShopServiceMode(process.env.SHOP_SERVICE_MODE);
}
