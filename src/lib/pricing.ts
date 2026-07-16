// The displayed medicine price is the lowest effective per-month rate across its active
// packages (price / duration_months), stored on medicines.from_price_cents. NULL means the
// medicine has no purchasable package yet.
export function formatFromPrice(fromPriceCents: number | null | undefined): string {
  if (fromPriceCents == null) return "Pricing coming soon";
  return `From ${formatMonthly(fromPriceCents)}/mo`;
}

export function formatMonthly(fromPriceCents: number): string {
  const dollars = fromPriceCents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function fromPriceDollars(fromPriceCents: number | null | undefined): number {
  return fromPriceCents == null ? 0 : fromPriceCents / 100;
}

// Human label for a package derived from its actual configured duration — never assume
// fixed monthly/quarterly buckets, since admins can set any duration.
export function planTitleFromDuration(durationMonths: number | null | undefined): string {
  if (!durationMonths || durationMonths < 1) return "Plan";
  return durationMonths === 1 ? "Monthly Plan" : `${durationMonths}-Month Plan`;
}

export function planSubtitleFromDuration(durationMonths: number | null | undefined): string {
  if (!durationMonths || durationMonths <= 1) return "Billed every 30 days. Cancel anytime.";
  return `Billed every ${durationMonths * 30} days with free shipping.`;
}

export function priceLabelFromDuration(
  amount: number,
  durationMonths: number | null | undefined,
): string {
  if (!durationMonths || durationMonths === 1) return `$${amount}/month`;
  if (durationMonths === 3) return `$${amount}/quarter`;
  return `$${amount}/${durationMonths} months`;
}
