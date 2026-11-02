import "server-only";

import type Stripe from "stripe";
import {
  invoiceHasCollectedPayment,
  subscriptionWillCancel,
  unpaidCheckoutAction,
} from "@/lib/billing/subscription-cancel";
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

  // A recreated checkout must not inherit invoice items left behind by a canceled attempt.
  const pendingItems = await stripe.invoiceItems.list({
    customer: customerId,
    pending: true,
    limit: 100,
  });
  for (const item of pendingItems.data) {
    if (!item.invoice) await stripe.invoiceItems.del(item.id);
  }

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
    expand: [
      "latest_invoice.payment_intent",
      "latest_invoice.confirmation_secret",
      "pending_setup_intent",
    ],
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

  // A promo that zeros the first invoice has no PaymentIntent. Stripe still returns a
  // SetupIntent so the patient can save a card for the renewal.
  const clientSecret = extractClientSecret(subscription) ?? setupIntentClientSecret(subscription);
  if (!clientSecret) {
    if (invoiceSettledWithoutPayment(subscription)) {
      return { subscriptionId: subscription.id, clientSecret: null, paid: true };
    }
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
    expand: [
      "latest_invoice.payment_intent",
      "latest_invoice.confirmation_secret",
      "pending_setup_intent",
    ],
  });
  return extractClientSecret(subscription) ?? setupIntentClientSecret(subscription);
}

async function subscriptionCollectedPayment(existing: Stripe.Subscription): Promise<boolean> {
  const latest = existing.latest_invoice;
  if (!latest) return false;
  if (typeof latest !== "string") return invoiceHasCollectedPayment(latest);
  const invoice = await stripe.invoices.retrieve(latest);
  return invoiceHasCollectedPayment(invoice);
}

export type CheckoutSubscriptionPlan =
  { action: "paid" } | { action: "resume"; clientSecret: string } | { action: "replace" };

/** Same browser, same intake, payment still open: keep the card form instead of blocking. */
export async function prepareCheckoutSubscription(params: {
  subscriptionId: string;
  packageId: string;
}): Promise<CheckoutSubscriptionPlan> {
  let existing: Stripe.Subscription;
  try {
    existing = await stripe.subscriptions.retrieve(params.subscriptionId, {
      expand: [
        "latest_invoice.payment_intent",
        "latest_invoice.confirmation_secret",
        "pending_setup_intent",
      ],
    });
  } catch {
    return { action: "replace" };
  }

  const latest = existing.latest_invoice;
  let amountPaid = 0;
  if (latest && typeof latest !== "string") {
    amountPaid = latest.amount_paid ?? 0;
  } else if (typeof latest === "string") {
    const invoice = await stripe.invoices.retrieve(latest);
    amountPaid = invoice.amount_paid ?? 0;
  }
  const secret = extractClientSecret(existing) ?? setupIntentClientSecret(existing);
  const action = unpaidCheckoutAction({
    status: existing.status,
    amountPaid,
    samePackage:
      !existing.metadata?.package_id || existing.metadata.package_id === params.packageId,
    hasClientSecret: Boolean(secret),
  });
  if (action === "paid") return { action: "paid" };
  if (action === "resume" && secret) return { action: "resume", clientSecret: secret };
  return { action: "replace" };
}

// Before creating a fresh subscription for a session, void any prior attempt that never
// collected money. alreadyPaid is true only when Stripe has actually charged this session.
export async function ensureNoActiveDuplicate(
  subscriptionId: string,
): Promise<{ alreadyPaid: boolean }> {
  let existing: Stripe.Subscription;
  try {
    existing = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
  } catch {
    return { alreadyPaid: false };
  }

  if (existing.status === "active" || existing.status === "trialing") {
    if (await subscriptionCollectedPayment(existing)) return { alreadyPaid: true };
    // Active only because nothing was due (a $0 invoice). Nothing was purchased.
    await stripe.subscriptions.cancel(subscriptionId);
    return { alreadyPaid: false };
  }

  if (existing.status !== "canceled" && existing.status !== "incomplete_expired") {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch {
      // Already gone.
    }
  }
  return { alreadyPaid: false };
}

type CancellationDetails = {
  feedback?: Stripe.SubscriptionUpdateParams.CancellationDetails["feedback"];
  comment?: string;
};

function stripeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function scheduleIdOf(sub: Stripe.Subscription): string | null {
  const scheduleRef = (sub as Stripe.Subscription & { schedule?: string | { id?: string } | null })
    .schedule;
  if (!scheduleRef) return null;
  return typeof scheduleRef === "string" ? scheduleRef : (scheduleRef.id ?? null);
}

function cancellationPayload(
  details?: CancellationDetails,
): Pick<Stripe.SubscriptionUpdateParams, "cancellation_details"> {
  if (!details) return {};
  const comment = details.comment?.trim().slice(0, 500);
  if (!details.feedback && !comment) return {};
  return {
    cancellation_details: {
      ...(details.feedback ? { feedback: details.feedback } : {}),
      ...(comment ? { comment } : {}),
    },
  };
}

/** Best-effort. A rejected reason must not undo a cancellation that already stuck. */
async function saveCancellationDetails(
  stripeSubscriptionId: string,
  details?: CancellationDetails,
): Promise<void> {
  const payload = cancellationPayload(details);
  if (!payload.cancellation_details) return;
  try {
    await stripe.subscriptions.update(stripeSubscriptionId, payload);
  } catch (error) {
    console.error("[billing] cancellation details not saved:", stripeErrorMessage(error));
  }
}

/**
 * Stop upcoming renewals without refunding the current paid period.
 * Plan changes attach a Stripe subscription schedule, and Stripe rejects
 * cancel_at_period_end while that schedule owns the subscription. Tell the
 * schedule to cancel at the end of its current phase instead of releasing it,
 * so the already-paid period stays intact.
 */
export async function cancelSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string,
  cancellationDetails?: CancellationDetails,
): Promise<Stripe.Subscription> {
  const existing = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  if (existing.status === "canceled" || existing.cancel_at_period_end) {
    await saveCancellationDetails(stripeSubscriptionId, cancellationDetails);
    return stripe.subscriptions.retrieve(stripeSubscriptionId);
  }

  const scheduleId = scheduleIdOf(existing);
  if (scheduleId) {
    let appliedOnSchedule = false;
    try {
      await stripe.subscriptionSchedules.update(scheduleId, { end_behavior: "cancel" });
      appliedOnSchedule = true;
    } catch (error) {
      const message = stripeErrorMessage(error);
      if (!/released|canceled|cancelled/i.test(message)) {
        try {
          await stripe.subscriptionSchedules.release(scheduleId);
        } catch (releaseError) {
          const releaseMessage = stripeErrorMessage(releaseError);
          if (!/released|not.?active|no such|canceled|cancelled/i.test(releaseMessage)) {
            throw releaseError;
          }
        }
      }
    }

    const afterSchedule = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    if (appliedOnSchedule || subscriptionWillCancel(afterSchedule)) {
      await saveCancellationDetails(stripeSubscriptionId, cancellationDetails);
      return stripe.subscriptions.retrieve(stripeSubscriptionId);
    }

    try {
      return await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
        proration_behavior: "none",
        ...cancellationPayload(cancellationDetails),
      });
    } catch (error) {
      if (/subscription schedule/i.test(stripeErrorMessage(error))) {
        await stripe.subscriptionSchedules.update(scheduleId, { end_behavior: "cancel" });
        await saveCancellationDetails(stripeSubscriptionId, cancellationDetails);
        return stripe.subscriptions.retrieve(stripeSubscriptionId);
      }
      throw error;
    }
  }

  try {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
      proration_behavior: "none",
      ...cancellationPayload(cancellationDetails),
    });
  } catch (error) {
    const message = stripeErrorMessage(error);
    if (/subscription schedule/i.test(message)) {
      const again = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const sid = scheduleIdOf(again);
      if (sid) {
        await stripe.subscriptionSchedules.update(sid, { end_behavior: "cancel" });
        await saveCancellationDetails(stripeSubscriptionId, cancellationDetails);
        return stripe.subscriptions.retrieve(stripeSubscriptionId);
      }
    }
    if (subscriptionWillCancel(await stripe.subscriptions.retrieve(stripeSubscriptionId))) {
      await saveCancellationDetails(stripeSubscriptionId, cancellationDetails);
      return stripe.subscriptions.retrieve(stripeSubscriptionId);
    }
    throw error;
  }
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

function setupIntentClientSecret(subscription: Stripe.Subscription): string | null {
  const setup = (
    subscription as Stripe.Subscription & {
      pending_setup_intent?: string | Stripe.SetupIntent | null;
    }
  ).pending_setup_intent;
  if (!setup || typeof setup === "string") return null;
  return setup.client_secret ?? null;
}

function invoiceSettledWithoutPayment(subscription: Stripe.Subscription): boolean {
  if (subscription.status !== "active" && subscription.status !== "trialing") return false;
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return false;
  const amountDue = (invoice as { amount_due?: number | null }).amount_due;
  const status = (invoice as { status?: string | null }).status;
  return status === "paid" || amountDue === 0;
}
