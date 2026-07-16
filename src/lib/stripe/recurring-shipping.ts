import "server-only";

import type Stripe from "stripe";
import { stripe } from "./server";

// Shipping is billed as a recurring subscription item so Stripe charges it every cycle
// natively (no per-cycle webhook, works with test clocks, appears on every invoice). A
// recurring item's interval must match the plan's, so we mint/reuse one shipping Price per
// (currency, interval, interval_count, amount). Prices are immutable; a lookup_key lets us
// reuse an existing one instead of piling up duplicates. Amount is therefore locked at
// subscription creation — changing the admin fee affects new subscriptions only.
export async function getOrCreateShippingPrice(params: {
  amountCents: number;
  interval: Stripe.Price.Recurring.Interval;
  intervalCount: number;
  currency: string;
}): Promise<string> {
  const { amountCents, interval, intervalCount, currency } = params;
  const lookupKey = `bi_shipping_${currency}_${interval}_${intervalCount}_${amountCents}`;

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const price = await stripe.prices.create({
    currency,
    unit_amount: amountCents,
    recurring: { interval, interval_count: intervalCount },
    lookup_key: lookupKey,
    product_data: { name: "Shipping" },
    metadata: { kind: "shipping" },
  });
  return price.id;
}
