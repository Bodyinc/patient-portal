/** Build authenticated shop checkout URL for refill / repurchase flows. */
export function buildShopCheckoutHref(options: {
  medicineId: string;
  variantId?: string | null;
  packageId?: string | null;
  from?: string | null;
}): string {
  const params = new URLSearchParams({ id: options.medicineId });
  if (options.variantId) params.set("variant", options.variantId);
  if (options.packageId) params.set("package", options.packageId);
  if (options.from) params.set("from", options.from);
  return `/shop/checkout?${params.toString()}`;
}
