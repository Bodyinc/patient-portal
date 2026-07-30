import "server-only";

import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordPayment } from "./record-payment";
import { stripe } from "./server";
import { sendTransactionalEmail } from "@/lib/email/send";
import { paymentReceiptEmail, refundNotificationEmail } from "@/lib/email/payment-emails";
import { maybeConvertReferral } from "@/lib/referrals";
import { incrementPromoRedemption } from "@/lib/stripe/promos";
import { recordInvoiceWalletDebit } from "@/lib/wallet";
import type { Json } from "@/lib/supabase/types";

// Field locations vary across Stripe API versions; read defensively.
function periodEndIso(sub: Stripe.Subscription): string | null {
  const anySub = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = anySub.current_period_end ?? anySub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const anyInv = invoice as unknown as {
    subscription?: string | { id?: string };
    parent?: { subscription_details?: { subscription?: string | { id?: string } } };
    lines?: { data?: Array<{ subscription?: string | { id?: string } }> };
  };
  const direct = anyInv.subscription;
  if (typeof direct === "string") return direct;
  if (direct?.id) return direct.id;
  const parent = anyInv.parent?.subscription_details?.subscription;
  if (typeof parent === "string") return parent;
  if (parent?.id) return parent.id;
  const line = anyInv.lines?.data?.find((l) => l.subscription);
  const ls = line?.subscription;
  if (typeof ls === "string") return ls;
  if (ls?.id) return ls.id;
  return null;
}

function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const pi = (invoice as unknown as { payment_intent?: string | { id?: string } }).payment_intent;
  if (typeof pi === "string") return pi;
  return pi?.id ?? null;
}

function customerId(source: { customer?: string | { id?: string } | null }): string | null {
  const c = source.customer;
  if (typeof c === "string") return c;
  return c?.id ?? null;
}

async function upsertSubscription(sub: Stripe.Subscription): Promise<void> {
  const meta = sub.metadata ?? {};
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;

  // Only the volatile fields are updated on existing rows, so the user_id/session_id set
  // at checkout (guest subs carry no user_id in metadata) are never clobbered back to null.
  const volatile = {
    stripe_customer_id: customerId(sub),
    stripe_price_id: priceId,
    status: sub.status,
    current_period_end: periodEndIso(sub),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };

  const { data: updated } = await supabaseAdmin
    .from("subscriptions")
    .update(volatile)
    .eq("stripe_subscription_id", sub.id)
    .select("id");

  if (updated && updated.length > 0) return;

  await supabaseAdmin.from("subscriptions").insert({
    stripe_subscription_id: sub.id,
    ...volatile,
    user_id: meta.user_id || null,
    session_id: meta.intake_session_id || null,
    package_id: meta.package_id || null,
    medicine_id: meta.medicine_id || null,
  });
}

async function customerEmailById(custId: string | null): Promise<string | null> {
  if (!custId) return null;
  try {
    const customer = await stripe.customers.retrieve(custId);
    if (!customer.deleted && customer.email) return customer.email;
  } catch {
    // Customer lookup is best-effort; the caller falls back to no email.
  }
  return null;
}

async function sendPaymentReceipt(invoice: Stripe.Invoice): Promise<void> {
  const to = invoice.customer_email ?? (await customerEmailById(customerId(invoice)));
  if (!to) return;

  const amountCents = invoice.amount_paid ?? invoice.amount_due ?? 0;
  if (amountCents <= 0) return;

  const description =
    invoice.lines?.data?.map((l) => l.description).find(Boolean) ?? "Body Inc subscription";

  const { subject, html } = paymentReceiptEmail({
    amountCents,
    currency: invoice.currency ?? "usd",
    description,
    invoiceNumber: invoice.number,
    invoiceUrl: invoice.hosted_invoice_url,
  });
  await sendTransactionalEmail({ to, subject, html });
}

async function redeemPromoFromSubscription(subscriptionId: string): Promise<void> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const promoId = subscription.metadata?.promo_id?.trim();
    if (!promoId) return;
    // Clear before increment so a duplicate invoice.paid / payment_succeeded pair is a no-op.
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { ...subscription.metadata, promo_id: "", promo_redeemed: "1" },
    });
    await incrementPromoRedemption(promoId);
  } catch (error) {
    console.error("[promos] redeem on invoice.paid failed:", error);
  }
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  options?: { notifyCustomer?: boolean },
): Promise<void> {
  if (options?.notifyCustomer) await sendPaymentReceipt(invoice);

  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const { data: subRow } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, session_id, package_id, medicine_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();

  const piId = invoicePaymentIntentId(invoice);

  await recordPayment({
    user_id: subRow?.user_id ?? null,
    session_id: subRow?.session_id ?? null,
    plan_id: subRow?.package_id ?? null,
    stripe_subscription_id: subId,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: piId,
    stripe_customer_id: customerId(invoice),
    amount_cents: invoice.amount_paid ?? invoice.amount_due ?? 0,
    currency: invoice.currency ?? "usd",
    status: "succeeded",
    raw_event: invoice as unknown as Json,
  });

  // First invoice only — renewals must not re-consume the onboarding promo.
  // Run on invoice.paid (notifyCustomer) so invoice.payment_succeeded doesn't double-count.
  if (options?.notifyCustomer && invoice.billing_reason === "subscription_create") {
    await redeemPromoFromSubscription(subId);
  }

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", subId);

  if (subRow?.user_id) {
    try {
      await maybeConvertReferral(subRow.user_id);
    } catch (error) {
      console.error("[referrals] convert on invoice.paid failed:", error);
    }
    await recordInvoiceWalletDebit(invoice, subRow.user_id);
  }

  const { data: order } = await supabaseAdmin
    .from("shop_checkout_orders")
    .update({
      status: "paid",
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: piId,
    })
    .eq("stripe_subscription_id", subId)
    .select("id")
    .maybeSingle();

  if (order?.id) {
    await supabaseAdmin.from("shop_checkout_events").insert({
      order_id: order.id,
      event_type: "payment_succeeded",
      payload: { stripe_subscription_id: subId, stripe_invoice_id: invoice.id },
    });
  }

  if (subRow?.session_id) {
    await supabaseAdmin
      .from("intake_sessions")
      .update({ status: "completed" })
      .eq("id", subRow.session_id);
  }

  // Order creation is handled by the DB trigger trg_create_medication_order on payments insert
  // (see migration 20260725110000 / 20260725120000), so it is not duplicated here.
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const subId = invoiceSubscriptionId(invoice);
  const piId = invoicePaymentIntentId(invoice);

  if (invoice.id) {
    const { data: subRow } = subId
      ? await supabaseAdmin
          .from("subscriptions")
          .select("user_id, session_id, package_id")
          .eq("stripe_subscription_id", subId)
          .maybeSingle()
      : { data: null };

    await recordPayment({
      user_id: subRow?.user_id ?? null,
      session_id: subRow?.session_id ?? null,
      plan_id: subRow?.package_id ?? null,
      stripe_subscription_id: subId,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: piId,
      stripe_customer_id: customerId(invoice),
      amount_cents: invoice.amount_due ?? 0,
      currency: invoice.currency ?? "usd",
      status: "failed",
      raw_event: invoice as unknown as Json,
    });
  }

  if (subId) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("stripe_subscription_id", subId);
  }
}

function chargePaymentIntentId(charge: Stripe.Charge): string | null {
  const pi = (charge as unknown as { payment_intent?: string | { id?: string } }).payment_intent;
  if (typeof pi === "string") return pi;
  return pi?.id ?? null;
}

// Reconciles refunds regardless of origin: an admin approval (which calls
// stripe.refunds.create) and a refund issued straight from the Stripe dashboard
// both land here. Marks the payment refunded and closes any open request.
async function sendRefundNotification(charge: Stripe.Charge): Promise<void> {
  const to =
    charge.receipt_email ??
    charge.billing_details?.email ??
    (await customerEmailById(customerId(charge)));
  if (!to) return;

  // charge.refunds is not always present on newer API versions; fall back to the
  // cumulative amount_refunded.
  const latestRefundCents =
    (charge as unknown as { refunds?: { data?: Array<{ amount?: number }> } }).refunds?.data?.[0]
      ?.amount ??
    charge.amount_refunded ??
    0;
  if (latestRefundCents <= 0) return;

  const { subject, html } = refundNotificationEmail({
    amountCents: latestRefundCents,
    currency: charge.currency ?? "usd",
    cardLast4: charge.payment_method_details?.card?.last4 ?? null,
  });
  await sendTransactionalEmail({ to, subject, html });
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  await sendRefundNotification(charge);

  const piId = chargePaymentIntentId(charge);
  const chargeInvoice = (charge as unknown as { invoice?: string | { id?: string } | null })
    .invoice;
  const invoiceId = typeof chargeInvoice === "string" ? chargeInvoice : (chargeInvoice?.id ?? null);

  // Match by payment_intent first; fall back to the invoice id so a refund issued from the
  // Stripe dashboard reconciles even when the payment row never captured a payment_intent.
  let payment: { id: string } | null = null;
  if (piId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", piId)
      .maybeSingle();
    payment = data ?? null;
  }
  if (!payment && invoiceId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_invoice_id", invoiceId)
      .maybeSingle();
    payment = data ?? null;
  }
  if (!payment?.id) return;

  await supabaseAdmin.from("payments").update({ status: "refunded" }).eq("id", payment.id);

  const refundId =
    (charge as unknown as { refunds?: { data?: Array<{ id?: string }> } }).refunds?.data?.[0]?.id ??
    null;

  await supabaseAdmin
    .from("refund_requests")
    .update({
      status: "approved",
      stripe_refund_id: refundId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("payment_id", payment.id)
    .eq("status", "pending");
}

// Workflow C: a patient paid the price difference for a changed medicine. Mark the additional
// payment paid and, once nothing is outstanding, move the order from awaiting_additional_payment
// to approved so the prescription can be generated. Non-additional-payment PaymentIntents (e.g.
// subscription invoices) match nothing here and no-op.
async function handleAdditionalPaymentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const metaId = (pi.metadata as Record<string, string> | undefined)?.additional_payment_id;

  type AddPayRow = {
    id: string;
    request_id: string;
    amount_cents: number;
    currency: string;
    user_id: string | null;
    reason: string | null;
  };
  const cols = "id, request_id, amount_cents, currency, user_id, reason";
  let row: AddPayRow | null = null;
  const { data: byPi } = await supabaseAdmin
    .from("additional_payments")
    .select(cols)
    .eq("stripe_payment_intent_id", pi.id)
    .eq("status", "pending")
    .maybeSingle();
  row = byPi ?? null;
  if (!row && metaId) {
    const { data: byMeta } = await supabaseAdmin
      .from("additional_payments")
      .select(cols)
      .eq("id", metaId)
      .eq("status", "pending")
      .maybeSingle();
    row = byMeta ?? null;
  }
  if (!row) return;

  await supabaseAdmin
    .from("additional_payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: pi.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  // Record the extra charge in payments so it appears in the patient's + admin's billing history.
  // stripe_subscription_id stays null, so the order-creation trigger ignores this insert.
  const description = row.reason ?? "Additional payment";
  await recordPayment({
    user_id: row.user_id,
    stripe_payment_intent_id: pi.id,
    stripe_customer_id: customerId(pi),
    amount_cents: row.amount_cents,
    currency: row.currency ?? "usd",
    status: "succeeded",
    raw_event: { lines: { data: [{ description }] } } as unknown as Json,
  });

  const { data: stillPending } = await supabaseAdmin
    .from("additional_payments")
    .select("id")
    .eq("request_id", row.request_id)
    .eq("status", "pending")
    .maybeSingle();
  if (stillPending) return;

  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select("id, status")
    .eq("id", row.request_id)
    .maybeSingle();
  if (req?.status !== "awaiting_additional_payment") return;

  await supabaseAdmin
    .from("medication_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", row.request_id);
  await supabaseAdmin.from("medication_request_events").insert({
    request_id: row.request_id,
    status: "approved",
    actor_role: "system",
    note: "Additional payment received.",
  });
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    // Both events fire for the same paid invoice; email only on invoice.paid so the
    // customer gets a single receipt.
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice, { notifyCustomer: true });
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoiceFailed(event.data.object as Stripe.Invoice);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;
    case "payment_intent.succeeded":
      await handleAdditionalPaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    default:
      break;
  }
}
