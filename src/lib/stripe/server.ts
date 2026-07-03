import "server-only";

import Stripe from "stripe";

function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing Stripe environment variable: STRIPE_SECRET_KEY");
  }
  return new Stripe(key);
}

let _stripe: Stripe | undefined;

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) _stripe = createStripeClient();
    return Reflect.get(_stripe, prop);
  },
});
