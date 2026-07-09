export type CheckoutPricing = {
  medicationTotal: number;
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  total: number;
};

// Discount is resolved server-side from the admin-managed promo_codes (an entered code or the
// auto-apply welcome promo) and passed in here for display. Only the medication is charged.
export function calculateCheckoutPricing(
  packagePrice: number | null | undefined,
  discount = 0,
  discountLabel: string | null = null,
): CheckoutPricing {
  const medicationTotal = packagePrice ?? 0;
  const subtotal = medicationTotal;
  const total = Math.max(0, subtotal - discount);

  return {
    medicationTotal,
    subtotal,
    discount,
    discountLabel,
    total,
  };
}
