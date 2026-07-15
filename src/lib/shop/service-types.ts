import type { ShopCategoryDto, ShopMedicinesListDto, ShopSortOption } from "./types";

export type ShopServiceMode = "legacy" | "dual" | "service";

export type ShopServiceError = {
  code: string;
  message: string;
};

export type ShopServiceMeta = {
  correlationId: string;
  mode: ShopServiceMode;
  durationMs: number;
};

export type ShopServiceResponse<T> =
  | { ok: true; data: T; error: null; meta: ShopServiceMeta }
  | { ok: false; data: null; error: ShopServiceError; meta: ShopServiceMeta };

export type ShopCatalogQuery = {
  category?: string | null;
  sort?: ShopSortOption;
  page?: number;
  pageSize?: number;
  q?: string;
};

export type ShopCheckoutPlanDto = {
  id: string;
  code: "monthly" | "quarterly";
  title: string;
  subtitle: string;
  priceLabel: string;
  amount: number;
  badge?: string;
};

export type ShopCheckoutPaymentMethodDto = {
  id: "card" | "alt" | "new";
  title: string;
  subtitle: string;
};

export type ShopCheckoutProductDto = {
  id: string;
  name: string;
  category: string;
  description: string;
  imageSrc: string;
  baseMonthlyPrice: number;
};

export type ShopCheckoutBootstrapDto = {
  product: ShopCheckoutProductDto;
  plans: ShopCheckoutPlanDto[];
  paymentMethods: ShopCheckoutPaymentMethodDto[];
  referralHint: string;
  defaultSelectedPlan: "monthly" | "quarterly";
};

export type ShopCheckoutOrderCreateInput = {
  medicineId: string;
  packageId: string | null;
  selectedPlanCode: "monthly" | "quarterly";
  paymentMethodCode: "card" | "alt" | "new";
  promoCode: string | null;
  promoSavings: number;
  subtotal: number;
  shipping: number;
  total: number;
};

export type ShopCheckoutOrderDto = {
  id: string;
  status: string;
  createdAt: string;
  productName: string;
  selectedPlanLabel: string;
  subtotal: number;
  promoSavings: number;
  shipping: number;
  consultation: number;
  total: number;
  // Actuals from the Stripe invoice once the order is paid; null before payment.
  walletApplied: number | null;
  totalPaid: number | null;
  discounts: Array<{ label: string; amount: number }> | null;
};

export type ShopCategoriesPayload = ShopCategoryDto[];
export type ShopCatalogPayload = ShopMedicinesListDto;
export type ShopCheckoutBootstrapPayload = ShopCheckoutBootstrapDto;
export type ShopCheckoutOrderPayload = ShopCheckoutOrderDto;

export type ShopReferralSharePayload = {
  referralCode: string;
  channel: "whatsapp" | "x" | "email" | "copy" | "other";
};
