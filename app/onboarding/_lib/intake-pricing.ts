import { CONSULTATION_FEE, PROCESSING_FEE } from "./onboarding-config";

export type CheckoutPricing = {
  medicationTotal: number;
  subtotal: number;
  processingFee: number;
  discount: number;
  discountLabel: string | null;
  total: number;
};

export const PROMO_CODES: Record<string, { discount: number; label: string }> = {
  WELCOME20: { discount: 22, label: "WELCOME20" },
};

export function resolvePromoDiscount(
  promoCode: string | null | undefined,
  durationMonths: number | null | undefined,
): { discount: number; label: string | null } {
  const normalized = promoCode?.trim().toUpperCase() ?? "";
  if (normalized && PROMO_CODES[normalized]) {
    return { discount: PROMO_CODES[normalized].discount, label: PROMO_CODES[normalized].label };
  }

  if (durationMonths === 3) {
    return { discount: 22, label: "WELCOME20" };
  }

  return { discount: 0, label: null };
}

export function calculateCheckoutPricing(
  packagePrice: number | null | undefined,
  durationMonths: number | null | undefined,
  promoCode?: string | null,
): CheckoutPricing {
  const medicationTotal = packagePrice ?? 0;
  const subtotal = medicationTotal + CONSULTATION_FEE;
  const processingFee = PROCESSING_FEE;
  const { discount, label } = resolvePromoDiscount(promoCode, durationMonths);
  const total = subtotal + processingFee - discount;

  return {
    medicationTotal,
    subtotal,
    processingFee,
    discount,
    discountLabel: label,
    total,
  };
}

export function validatePromoCode(code: string): { valid: boolean; message: string } {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, message: "Enter a promo code" };
  }
  if (!PROMO_CODES[normalized]) {
    return { valid: false, message: "Invalid promo code" };
  }
  return { valid: true, message: `Promo code ${normalized} applied` };
}
