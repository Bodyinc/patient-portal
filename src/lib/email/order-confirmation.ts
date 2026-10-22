import "server-only";

import { loadCheckoutCart } from "@/lib/intake/session-cart";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import { ensureMedicationOrderForPayment } from "@/lib/orders/ensure-medication-order";
import { sendOnce, wasEmailSent, markEmailSent } from "./idempotency";
import { orderConfirmedEmail, type OrderConfirmationLine } from "./order-confirmation-emails";
import { appUrl, patientEmailByUserId } from "./recipients";
import { sendTransactionalEmail } from "./send";
import { sendPushToUser } from "@/lib/push/send";

const REMINDER_TYPE = "order_confirmation";

type OrderRow = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  medicine_id: string | null;
  variant_id: string | null;
  package_id: string | null;
  kind: string;
  requires_consultation: boolean;
};

const ORDER_COLUMNS =
  "id, user_id, session_id, medicine_id, variant_id, package_id, kind, requires_consultation";

async function isAddonInitialPayment(stripeSubscriptionId: string | null): Promise<boolean> {
  if (!stripeSubscriptionId) return false;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, is_checkout_primary")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (!sub || sub.is_checkout_primary !== false) return false;

  const { data: prior } = await supabaseAdmin
    .from("medication_requests")
    .select("id")
    .eq("subscription_id", sub.id)
    .eq("kind", "followup")
    .limit(1)
    .maybeSingle();
  return !prior;
}

async function suppressAddonCheckoutReceipts(stripeSubscriptionId: string | null): Promise<void> {
  if (!stripeSubscriptionId) return;
  const { data: primary } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("is_checkout_primary", true)
    .maybeSingle();
  if (!primary?.id) return;

  const { data: addons } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("checkout_group_id", primary.id)
    .eq("is_checkout_primary", false);
  const stripeIds = (addons ?? [])
    .map((row) => row.stripe_subscription_id)
    .filter((id): id is string => Boolean(id));
  if (stripeIds.length === 0) return;

  const { data: payments } = await supabaseAdmin
    .from("payments")
    .select("id")
    .in("stripe_subscription_id", stripeIds);
  for (const row of payments ?? []) {
    if (!(await wasEmailSent(REMINDER_TYPE, row.id))) {
      await markEmailSent(REMINDER_TYPE, row.id);
    }
  }
}

function invoiceUrlFromRawEvent(rawEvent: unknown): string | null {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) return null;
  const url = (rawEvent as { hosted_invoice_url?: unknown }).hosted_invoice_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

// The order row can be written either by the DB trigger (on payment insert) or by
// ensureMedicationOrderForPayment, so look it up by payment first and fall back to the invoice.
async function findOrderForPayment(payment: {
  id: string;
  stripe_invoice_id: string | null;
  stripe_subscription_id?: string | null;
}): Promise<OrderRow | null> {
  const { data: byPayment } = await supabaseAdmin
    .from("medication_requests")
    .select(ORDER_COLUMNS)
    .eq("payment_id", payment.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byPayment) return byPayment as OrderRow;

  if (payment.stripe_invoice_id) {
    const { data: byInvoice } = await supabaseAdmin
      .from("medication_requests")
      .select(ORDER_COLUMNS)
      .eq("stripe_invoice_id", payment.stripe_invoice_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byInvoice) return byInvoice as OrderRow;
  }

  if (!payment.stripe_subscription_id) return null;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", payment.stripe_subscription_id)
    .maybeSingle();
  if (!sub?.id) return null;
  const { data: bySub } = await supabaseAdmin
    .from("medication_requests")
    .select(ORDER_COLUMNS)
    .eq("subscription_id", sub.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (bySub as OrderRow | null) ?? null;
}

async function waitForOrder(payment: {
  id: string;
  stripe_invoice_id: string | null;
  stripe_subscription_id?: string | null;
}): Promise<OrderRow | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300));
    await ensureMedicationOrderForPayment({ paymentId: payment.id });
    const order = await findOrderForPayment(payment);
    if (order) return order;
  }
  return null;
}

// During onboarding the account may not be claimed yet, so fall back to the intake session.
async function resolveRecipient(
  order: OrderRow,
): Promise<{ email: string; fullName: string | null } | null> {
  const byUser = await patientEmailByUserId(order.user_id);
  if (byUser) return byUser;

  if (!order.session_id) return null;
  const { data: session } = await supabaseAdmin
    .from("intake_sessions")
    .select("email, full_name")
    .eq("id", order.session_id)
    .maybeSingle();

  const email = session?.email?.trim();
  if (!email) return null;
  return { email, fullName: session?.full_name ?? null };
}

async function loadOrderLabels(order: OrderRow): Promise<{
  medicineName: string;
  variantName: string | null;
  planName: string | null;
  lines: OrderConfirmationLine[];
}> {
  const [medicine, variant, pkg] = await Promise.all([
    order.medicine_id
      ? supabaseAdmin.from("medicines").select("name").eq("id", order.medicine_id).maybeSingle()
      : Promise.resolve({ data: null }),
    order.variant_id
      ? supabaseAdmin
          .from("medicine_variants")
          .select("name")
          .eq("id", order.variant_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    order.package_id
      ? supabaseAdmin.from("packages").select("name").eq("id", order.package_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const fallbackName = medicine.data?.name ?? "Your medication";
  const cart = order.session_id ? await loadCheckoutCart(order.session_id) : [];
  const lines: OrderConfirmationLine[] = cart
    .filter((line) => line.medicineName)
    .map((line) => ({
      name: line.medicineName,
      detail:
        [line.variantName, line.packageName ?? line.categoryName].filter(Boolean).join(" · ") ||
        null,
      amountCents: line.packagePrice != null ? Math.round(Number(line.packagePrice) * 100) : null,
    }));

  if (order.kind === "initial" && lines.length > 1) {
    return {
      medicineName: lines.map((line) => line.name).join(", "),
      variantName: null,
      planName: null,
      lines,
    };
  }

  return {
    medicineName: lines[0]?.name || fallbackName,
    variantName: variant.data?.name ?? null,
    planName: pkg.data?.name ?? null,
    lines,
  };
}

/**
 * Sends one combined payment + order confirmation email. Called from the payment write path
 * so it fires for both the Stripe webhook and the on-demand reconcile. Claimed before send so
 * invoice.paid, invoice.payment_succeeded, and reconcile cannot deliver it twice.
 */
export async function sendOrderConfirmationEmail(paymentId: string): Promise<boolean> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select(
      "id, status, amount_cents, currency, stripe_invoice_id, stripe_subscription_id, stripe_payment_intent_id, raw_event",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status !== "succeeded") {
    console.warn("[email] order confirmation skipped: payment not succeeded", paymentId);
    return false;
  }

  // Add-on subscriptions open on a $0 trial invoice. The receipt is the
  // primary checkout payment, which already includes every medicine.
  if ((payment.amount_cents ?? 0) <= 0) return false;

  // One checkout sends one receipt, from the primary payment. An added
  // medicine keeps its own subscription, but its first invoice is not a
  // second order confirmation.
  if (await isAddonInitialPayment(payment.stripe_subscription_id)) return false;

  if (await wasEmailSent(REMINDER_TYPE, payment.id)) return false;

  if (payment.stripe_payment_intent_id) {
    const { data: extraPay } = await supabaseAdmin
      .from("additional_payments")
      .select("id")
      .eq("stripe_payment_intent_id", payment.stripe_payment_intent_id)
      .maybeSingle();
    if (extraPay) return false;
  }

  const order = await waitForOrder(payment);
  if (!order) {
    console.warn("[email] order confirmation skipped: no order row yet for payment", paymentId);
    return false;
  }

  if (
    (await wasEmailSent(REMINDER_TYPE, order.id)) ||
    (await wasEmailSent(REMINDER_TYPE, payment.id))
  ) {
    return false;
  }

  const recipient = await resolveRecipient(order);
  if (!recipient) {
    console.warn("[email] order confirmation skipped: no patient email for order", order.id);
    return false;
  }

  const labels = await loadOrderLabels(order);
  const { subject, html } = orderConfirmedEmail({
    fullName: recipient.fullName,
    medicineName: labels.medicineName,
    variantName: labels.variantName,
    planName: labels.planName,
    lines: labels.lines,
    orderNumber: formatOrderId(order.id),
    amountCents: payment.amount_cents,
    currency: payment.currency,
    requiresConsultation: order.requires_consultation,
    isRefill: order.kind !== "initial",
    myMedsUrl: `${appUrl()}/my-meds`,
    consultationsUrl: `${appUrl()}/consultations`,
    invoiceUrl: invoiceUrlFromRawEvent(payment.raw_event),
  });

  // email_reminders.target_id is uuid. Claim the payment row (shared by invoice.paid +
  // payment_succeeded). Also honor an older claim keyed on the order id.
  if (await wasEmailSent(REMINDER_TYPE, order.id)) {
    await markEmailSent(REMINDER_TYPE, payment.id);
    return false;
  }
  const sent = await sendOnce(REMINDER_TYPE, payment.id, () =>
    sendTransactionalEmail({ to: recipient.email, subject, html }),
  );
  if (sent) {
    await suppressAddonCheckoutReceipts(payment.stripe_subscription_id);
  }
  if (sent && order.user_id) {
    await sendPushToUser(order.user_id, {
      title: "Order confirmed",
      body: `${labels.medicineName} · ${formatOrderId(order.id)}`,
      url: order.requires_consultation ? "/consultations" : "/my-meds",
    }).catch((error) => console.error("[push] order confirmation failed:", error));
  }
  return sent;
}

/** Retry confirmations that were skipped because the order row was not ready yet. */
export async function sendMissedOrderConfirmationEmails(): Promise<number> {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: payments, error } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("status", "succeeded")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("[email] missed order confirmation lookup failed:", error.message);
    return 0;
  }

  let sent = 0;
  for (const payment of payments ?? []) {
    if (await sendOrderConfirmationEmail(payment.id)) sent += 1;
  }
  return sent;
}
