import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import { sendOnce, wasEmailSent, markEmailSent } from "./idempotency";
import { orderConfirmedEmail } from "./order-confirmation-emails";
import { appUrl, patientEmailByUserId } from "./recipients";
import { sendTransactionalEmail } from "./send";

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
}): Promise<OrderRow | null> {
  const { data: byPayment } = await supabaseAdmin
    .from("medication_requests")
    .select(ORDER_COLUMNS)
    .eq("payment_id", payment.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byPayment) return byPayment as OrderRow;

  if (!payment.stripe_invoice_id) return null;
  const { data: byInvoice } = await supabaseAdmin
    .from("medication_requests")
    .select(ORDER_COLUMNS)
    .eq("stripe_invoice_id", payment.stripe_invoice_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (byInvoice as OrderRow | null) ?? null;
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

  return {
    medicineName: medicine.data?.name ?? "Your medication",
    variantName: variant.data?.name ?? null,
    planName: pkg.data?.name ?? null,
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
    .select("id, status, amount_cents, currency, stripe_invoice_id, raw_event")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status !== "succeeded") {
    console.warn("[email] order confirmation skipped: payment not succeeded", paymentId);
    return false;
  }

  const order = await findOrderForPayment(payment);
  if (!order) {
    console.warn("[email] order confirmation skipped: no order row yet for payment", paymentId);
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
    orderNumber: formatOrderId(order.id),
    amountCents: payment.amount_cents,
    currency: payment.currency,
    requiresConsultation: order.requires_consultation,
    isRefill: order.kind !== "initial",
    myMedsUrl: `${appUrl()}/my-meds`,
    invoiceUrl: invoiceUrlFromRawEvent(payment.raw_event),
  });

  // Key on the invoice (fallback: payment row) so invoice.paid + invoice.payment_succeeded +
  // reconcile cannot send twice even if two order rows exist for the same checkout.
  const claimId = payment.stripe_invoice_id?.trim() || payment.id;
  if (claimId !== order.id && (await wasEmailSent(REMINDER_TYPE, order.id))) {
    await markEmailSent(REMINDER_TYPE, claimId);
    return false;
  }
  return sendOnce(REMINDER_TYPE, claimId, () =>
    sendTransactionalEmail({ to: recipient.email, subject, html }),
  );
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
