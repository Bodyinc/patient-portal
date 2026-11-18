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
  /**
   * The first invoice is already settled, including a promo that zeros it.
   * Checkout treats this as paid immediately (no card form required).
   */
  invoiceSettled: boolean;
};

export async function createSubscriptionForPrice(params: {
  customerId: string;
  priceId: string;
  metadata: Record<string, string>;
  // Human-readable label shown on the subscription in the Stripe dashboard.
  description?: string;
  promotionCodeId?: string | null;
  /**
   * When true, the cart total after promo is $0. If Stripe still opens a chargeable
   * PaymentIntent, cancel and fail instead of sending the patient a bank OTP for the
   * full plan amount.
   */
  expectZeroFirstInvoice?: boolean;
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
    expectZeroFirstInvoice = false,
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

  // Positive one-time lines only (consultation, add-ons). Promos go through promotionCodeId —
  // a negative pending invoice item was what let the UI say $0 while the bank still saw $181.
  for (const fee of oneTimeFees ?? []) {
    if (fee.amountCents <= 0) continue;
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

  const amountDue = invoiceAmountDue(subscription);
  if (expectZeroFirstInvoice && (amountDue ?? 0) > 0) {
    try {
      await stripe.subscriptions.cancel(subscription.id);
    } catch (error) {
      console.error("[stripe] failed to cancel non-zero promo subscription:", error);
    }
    throw new Error(
      "This promo could not be applied to the card charge. Nothing was charged. Please try again.",
    );
  }

  // A 100% promo can activate the subscription with a $0 invoice (and may still attach a
  // SetupIntent in Stripe). Treat the invoice as settled for checkout completion.
  const invoiceSettled = invoiceSettledWithoutPayment(subscription);

  if (defaultPaymentMethodId && !invoiceSettled) {
    const charged = await tryChargeSavedPaymentMethod({
      subscription,
      paymentMethodId: defaultPaymentMethodId,
    });
    if (charged.paid) {
      return {
        subscriptionId: subscription.id,
        clientSecret: null,
        paid: true,
        invoiceSettled: true,
      };
    }
    // 3-D Secure / bank confirm only — never a SetupIntent "save card" when one is on file.
    if (charged.clientSecret && !charged.clientSecret.startsWith("seti_")) {
      return {
        subscriptionId: subscription.id,
        clientSecret: charged.clientSecret,
        paid: false,
        invoiceSettled,
      };
    }
  }

  // Free first invoice: never hand the browser a PaymentIntent (that is what triggered
  // the bank OTP for the full plan). Do not require SetupIntent here either — the purchase
  // is already complete and checkout should go straight to confirmation. Patients can save
  // a renewal card later from Billing.
  if (invoiceSettled || (amountDue ?? 0) === 0) {
    return {
      subscriptionId: subscription.id,
      clientSecret: null,
      paid: true,
      invoiceSettled: true,
    };
  }

  // Card already on file: only a PaymentIntent (e.g. 3DS) may go to the browser — never
  // SetupIntent, which would re-ask them to save card details in shop.
  if (defaultPaymentMethodId) {
    const paymentSecret = extractClientSecret(subscription);
    if (paymentSecret && !paymentSecret.startsWith("seti_")) {
      return {
        subscriptionId: subscription.id,
        clientSecret: paymentSecret,
        paid: false,
        invoiceSettled,
      };
    }
    throw new Error(
      "We couldn't charge your saved card. Please update your card in Billing and try again.",
    );
  }

  const clientSecret = extractClientSecret(subscription) ?? setupIntentClientSecret(subscription);
  if (!clientSecret) {
    throw new Error("Stripe returned no client secret for the subscription's first invoice.");
  }

  return { subscriptionId: subscription.id, clientSecret, paid: false, invoiceSettled };
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
  /** Current cart total after promo. Mismatch means replace (e.g. 100OFF applied after open). */
  expectedAmountDueCents?: number | null;
  /** Current promo label, or empty when none. Mismatch means replace. */
  expectedPromoCode?: string | null;
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
  let amountDue: number | null = null;
  if (latest && typeof latest !== "string") {
    amountPaid = latest.amount_paid ?? 0;
    amountDue = latest.amount_due ?? null;
  } else if (typeof latest === "string") {
    const invoice = await stripe.invoices.retrieve(latest);
    amountPaid = invoice.amount_paid ?? 0;
    amountDue = invoice.amount_due ?? null;
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
  // Full promo / $0 first invoice is already complete — never reopen a SetupIntent as unpaid.
  if (amountDue === 0) {
    return { action: "paid" };
  }
  if (action === "resume" && secret) {
    // Applying 100OFF after the card form opened used to resume the old $471 PaymentIntent
    // while the UI showed $0. Only resume when promo + amount still match this checkout.
    const metaPromo = (existing.metadata?.promo_code ?? "").trim().toUpperCase();
    const expectedPromo = (params.expectedPromoCode ?? "").trim().toUpperCase();
    if (expectedPromo !== metaPromo) return { action: "replace" };
    if (
      params.expectedAmountDueCents != null &&
      amountDue != null &&
      Math.abs(amountDue - params.expectedAmountDueCents) > 1
    ) {
      return { action: "replace" };
    }
    // Never resume a SetupIntent as a charge — only PaymentIntents belong on the card form.
    if (secret.startsWith("seti_")) {
      return { action: "replace" };
    }
    return { action: "resume", clientSecret: secret };
  }
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
    // Active with a $0 first invoice (e.g. 100% promo) is a completed purchase — keep it.
    const latest = existing.latest_invoice;
    const due = latest && typeof latest !== "string" ? (latest.amount_due ?? null) : null;
    if (due === 0) return { alreadyPaid: true };
    // Active with nothing due and no settled $0 invoice — abandon and start fresh.
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

function invoiceAmountDue(subscription: Stripe.Subscription): number | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;
  const amountDue = (invoice as { amount_due?: number | null }).amount_due;
  return typeof amountDue === "number" ? amountDue : null;
}

function invoiceSettledWithoutPayment(subscription: Stripe.Subscription): boolean {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return false;
  const amountDue = invoiceAmountDue(subscription);
  const status = (invoice as { status?: string | null }).status;
  if (status === "paid" || amountDue === 0) return true;
  return (
    (subscription.status === "active" || subscription.status === "trialing") && amountDue === 0
  );
}
