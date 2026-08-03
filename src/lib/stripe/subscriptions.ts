import "server-only";

import type Stripe from "stripe";
import { stripe } from "./server";
import { getOrCreateShippingPrice } from "./recurring-shipping";

export type CreatedSubscription = {
  subscriptionId: string;
  /** Null when the first invoice was already paid with a saved card. */
  clientSecret: string | null;
  paid: boolean;
};

export async function createSubscriptionForPrice(params: {
  customerId: string;
  priceId: string;
  metadata: Record<string, string>;
  // Human-readable label shown on the subscription in the Stripe dashboard.
  description?: string;
  promotionCodeId?: string | null;
  oneTimeFees?: Array<{ amountCents: number; description: string }>;
  // >0 adds shipping as a recurring subscription item. shippingOnFirstInvoice=true bills it
  // from the first invoice (shop orders); false starts it on the first renewal (onboarding).
  recurringShippingCents?: number;
  shippingOnFirstInvoice?: boolean;
  /** When set, attempt to charge this saved card immediately (shop checkout). */
  defaultPaymentMethodId?: string | null;
}): Promise<CreatedSubscription> {
  const {
    customerId,
    priceId,
    metadata,
    description,
    promotionCodeId,
    oneTimeFees,
    recurringShippingCents = 0,
    shippingOnFirstInvoice = false,
    defaultPaymentMethodId = null,
  } = params;

  // Pending invoice items on the customer get pulled into the subscription's first
  // invoice, so the first charge equals the cart total (plan + one-time fees).
  for (const fee of oneTimeFees ?? []) {
    if (fee.amountCents === 0) continue; // keep negative items (discounts); skip only zero
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: fee.amountCents,
      currency: "usd",
      description: fee.description,
    });
  }

  // A recurring shipping item must share the plan's billing interval, so mirror it.
  let shippingPriceId: string | null = null;
  if (recurringShippingCents > 0) {
    const planPrice = await stripe.prices.retrieve(priceId);
    if (planPrice.recurring) {
      shippingPriceId = await getOrCreateShippingPrice({
        amountCents: recurringShippingCents,
        interval: planPrice.recurring.interval,
        intervalCount: planPrice.recurring.interval_count,
        currency: planPrice.currency ?? "usd",
      });
    }
  }

  const items: Stripe.SubscriptionCreateParams.Item[] = [{ price: priceId }];
  if (shippingPriceId && shippingOnFirstInvoice) items.push({ price: shippingPriceId });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items,
    description: description || undefined,
    discounts: promotionCodeId ? [{ promotion_code: promotionCodeId }] : undefined,
    ...(defaultPaymentMethodId ? { default_payment_method: defaultPaymentMethodId } : {}),
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
      payment_method_types: ["card"],
    },
    metadata,
    expand: ["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"],
  });

  // Onboarding: add shipping AFTER the first invoice exists, with no proration, so the first
  // invoice stays medication-only and shipping begins on the first renewal.
  if (shippingPriceId && !shippingOnFirstInvoice) {
    await stripe.subscriptionItems.create({
      subscription: subscription.id,
      price: shippingPriceId,
      proration_behavior: "none",
    });
  }

  if (defaultPaymentMethodId) {
    const charged = await tryChargeSavedPaymentMethod({
      subscription,
      paymentMethodId: defaultPaymentMethodId,
    });
    if (charged.paid) {
      return { subscriptionId: subscription.id, clientSecret: null, paid: true };
    }
    if (charged.clientSecret) {
      return {
        subscriptionId: subscription.id,
        clientSecret: charged.clientSecret,
        paid: false,
      };
    }
  }

  const clientSecret = extractClientSecret(subscription);
  if (!clientSecret) {
    throw new Error("Stripe returned no client secret for the subscription's first invoice.");
  }

  return { subscriptionId: subscription.id, clientSecret, paid: false };
}

async function tryChargeSavedPaymentMethod(params: {
  subscription: Stripe.Subscription;
  paymentMethodId: string;
}): Promise<{ paid: boolean; clientSecret: string | null }> {
  const { subscription, paymentMethodId } = params;

  if (subscription.status === "active" || subscription.status === "trialing") {
    return { paid: true, clientSecret: null };
  }

  const paymentIntent = getPaymentIntent(subscription);
  if (!paymentIntent) {
    return { paid: false, clientSecret: extractClientSecret(subscription) };
  }

  if (paymentIntent.status === "succeeded") {
    return { paid: true, clientSecret: null };
  }

  if (paymentIntent.status === "requires_action" && paymentIntent.client_secret) {
    return { paid: false, clientSecret: paymentIntent.client_secret };
  }

  if (
    paymentIntent.status === "requires_confirmation" ||
    paymentIntent.status === "requires_payment_method"
  ) {
    try {
      const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: paymentMethodId,
        off_session: true,
      });
      if (confirmed.status === "succeeded") {
        return { paid: true, clientSecret: null };
      }
      if (confirmed.status === "requires_action" && confirmed.client_secret) {
        return { paid: false, clientSecret: confirmed.client_secret };
      }
      return {
        paid: false,
        clientSecret: confirmed.client_secret ?? extractClientSecret(subscription),
      };
    } catch (error) {
      const secret = extractClientSecretFromStripeError(error) ?? paymentIntent.client_secret;
      if (secret) return { paid: false, clientSecret: secret };
      throw error;
    }
  }

  return {
    paid: false,
    clientSecret: paymentIntent.client_secret ?? extractClientSecret(subscription),
  };
}

function getPaymentIntent(subscription: Stripe.Subscription): Stripe.PaymentIntent | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;
  const paymentIntent = (
    invoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null;
    }
  ).payment_intent;
  if (!paymentIntent || typeof paymentIntent === "string") return null;
  return paymentIntent;
}

function extractClientSecretFromStripeError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const paymentIntent = (error as { payment_intent?: Stripe.PaymentIntent }).payment_intent;
  return paymentIntent?.client_secret ?? null;
}

export async function retrieveSubscriptionClientSecret(
  subscriptionId: string,
): Promise<string | null> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"],
  });
  return extractClientSecret(subscription);
}

// Before creating a fresh subscription for a session, void any prior incomplete one so
// pricing/fee changes take effect and duplicates don't pile up. Returns alreadyPaid=true
// if the prior subscription is already active (so we must NOT re-charge).
export async function ensureNoActiveDuplicate(
  subscriptionId: string,
): Promise<{ alreadyPaid: boolean }> {
  try {
    const existing = await stripe.subscriptions.retrieve(subscriptionId);
    if (existing.status === "active" || existing.status === "trialing") {
      return { alreadyPaid: true };
    }
    if (existing.status !== "canceled") {
      await stripe.subscriptions.cancel(subscriptionId);
    }
  } catch {
    // Not found — nothing to clean up.
  }
  return { alreadyPaid: false };
}

export async function cancelSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string,
  cancellationDetails?: {
    feedback?: Stripe.SubscriptionUpdateParams.CancellationDetails["feedback"];
    comment?: string;
  },
) {
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
    ...(cancellationDetails ? { cancellation_details: cancellationDetails } : {}),
  });
}

// The location of the first-invoice client secret differs by Stripe API version:
// newer versions expose invoice.confirmation_secret, older ones a PaymentIntent.
// Verify against the account's pinned API version when wiring test keys.
function extractClientSecret(subscription: Stripe.Subscription): string | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;

  const confirmationSecret = (invoice as { confirmation_secret?: { client_secret?: string } })
    .confirmation_secret?.client_secret;
  if (confirmationSecret) return confirmationSecret;

  const paymentIntent = (invoice as { payment_intent?: string | { client_secret?: string } })
    .payment_intent;
  if (paymentIntent && typeof paymentIntent !== "string" && paymentIntent.client_secret) {
    return paymentIntent.client_secret;
  }

  return null;
}
