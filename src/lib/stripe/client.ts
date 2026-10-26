import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | undefined;

export function getStripeJs(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
  }
  return stripePromise;
}

/** A $0 first invoice uses a SetupIntent (`seti_`) so the card can be saved for renewal. */
export function isSetupIntentClientSecret(clientSecret: string): boolean {
  return clientSecret.startsWith("seti_");
}
