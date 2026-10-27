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

export function paymentErrorMessage(
  error: { message?: string; decline_code?: string } | null | undefined,
  fallback: string,
): string {
  const message = error?.message ?? "";
  const decline = error?.decline_code ?? "";
  if (decline === "live_mode_test_card" || /known test card/i.test(message)) {
    return "This is a test card. Enter a real debit or credit card to pay.";
  }
  return message || fallback;
}
