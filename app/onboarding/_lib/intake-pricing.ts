import { CONSULTATION_FEE, PROCESSING_FEE } from "./onboarding-config";

export type CheckoutPricing = {
  medicationTotal: number;
  subtotal: number;
  processingFee: number;
  discount: number;
  discountLabel: string | null;
  total: number;
};

// Discount is resolved server-side from the admin-managed promo_codes (an entered code or the
// auto-apply welcome promo) and passed in here for display.
export function calculateCheckoutPricing(
  packagePrice: number | null | undefined,
  discount = 0,
  discountLabel: string | null = null,
): CheckoutPricing {
  const medicationTotal = packagePrice ?? 0;
  const subtotal = medicationTotal + CONSULTATION_FEE;
  const processingFee = PROCESSING_FEE;
  const total = Math.max(0, subtotal + processingFee - discount);

  return {
    medicationTotal,
    subtotal,
    processingFee,
    discount,
    discountLabel,
    total,
  };
}
