import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import { sendOnce } from "./idempotency";
import { adminAppUrl, adminRecipientEmails, patientEmailByUserId } from "./recipients";
import { sendTransactionalEmail } from "./send";
import { emailButton, emailLayout } from "./layout";

const REMINDER_TYPE = "admin_new_request";

type OrderRow = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  medicine_id: string | null;
  variant_id: string | null;
  package_id: string | null;
  kind: string;
  status: string;
  requires_consultation: boolean;
};

const ORDER_COLUMNS =
  "id, user_id, session_id, medicine_id, variant_id, package_id, kind, status, requires_consultation";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function adminNewRequestEmail(params: {
  patientName: string;
  patientEmail: string;
  medicineName: string;
  variantName: string | null;
  planName: string | null;
  orderNumber: string;
  kind: string;
  status: string;
  reviewUrl: string | null;
}): { subject: string; html: string } {
  const kindLabel = params.kind === "followup" ? "Refill" : "Initial";
  const rows = [
    ["Patient", `${params.patientName} (${params.patientEmail})`],
    ["Order", params.orderNumber],
    ["Type", kindLabel],
    ["Medication", params.medicineName],
    params.variantName ? ["Dosage", params.variantName] : null,
    params.planName ? ["Plan", params.planName] : null,
    ["Status", params.status.replace(/_/g, " ")],
  ].filter(Boolean) as [string, string][];

  const details = rows
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join("");

  const body = [
    `<p>A new medication request was created and is waiting in the admin queue.</p>`,
    details,
    params.reviewUrl ? emailButton("Open request", params.reviewUrl) : "",
  ].join("");

  return {
    subject: `[Body Inc] New request — ${params.medicineName} (${params.orderNumber})`,
    html: emailLayout("New medication request", body),
  };
}

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

async function resolvePatient(order: OrderRow): Promise<{
  email: string;
  fullName: string | null;
}> {
  const byUser = await patientEmailByUserId(order.user_id);
  if (byUser) return byUser;

  if (!order.session_id) return { email: "not provided", fullName: null };
  const { data: session } = await supabaseAdmin
    .from("intake_sessions")
    .select("email, full_name")
    .eq("id", order.session_id)
    .maybeSingle();

  return {
    email: session?.email?.trim() || "not provided",
    fullName: session?.full_name ?? null,
  };
}

/**
 * Notifies every admin inbox once per medication request. Called from the payment settle path
 * so it fires whether the row was created by the DB trigger or the app-level backstop.
 */
export async function sendAdminNewRequestEmail(paymentId: string): Promise<boolean> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, status, stripe_invoice_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status !== "succeeded") return false;

  const order = await findOrderForPayment(payment);
  if (!order) {
    console.warn("[email] admin new-request skipped: no order row yet for payment", paymentId);
    return false;
  }

  const recipients = await adminRecipientEmails();
  if (recipients.length === 0) {
    console.warn("[email] admin new-request skipped: no admin emails configured");
    return false;
  }

  const [medicine, variant, pkg, patient] = await Promise.all([
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
    resolvePatient(order),
  ]);

  const reviewUrl = adminAppUrl() ? `${adminAppUrl()}/admin/requests/${order.id}` : null;
  const { subject, html } = adminNewRequestEmail({
    patientName: patient.fullName?.trim() || "Unknown patient",
    patientEmail: patient.email,
    medicineName: medicine.data?.name ?? "Medication",
    variantName: variant.data?.name ?? null,
    planName: pkg.data?.name ?? null,
    orderNumber: formatOrderId(order.id),
    kind: order.kind,
    status: order.status,
    reviewUrl,
  });

  return sendOnce(REMINDER_TYPE, order.id, async () => {
    let sentAny = false;
    for (const to of recipients) {
      const ok = await sendTransactionalEmail({ to, subject, html });
      if (ok) sentAny = true;
      else console.error(`[email] admin new-request failed for ${to}`);
    }
    return sentAny;
  });
}

/** Retry admin new-request mail that was skipped because the order row was not ready yet. */
export async function sendMissedAdminNewRequestEmails(): Promise<number> {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: payments, error } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("status", "succeeded")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("[email] missed admin new-request lookup failed:", error.message);
    return 0;
  }

  let sent = 0;
  for (const payment of payments ?? []) {
    if (await sendAdminNewRequestEmail(payment.id)) sent += 1;
  }
  return sent;
}
