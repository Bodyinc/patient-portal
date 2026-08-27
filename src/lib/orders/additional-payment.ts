import "server-only";

import type Stripe from "stripe";

import { additionalPaymentReceivedEmail } from "@/lib/email/lifecycle-emails";
import { sendUnsentOrderStatusEmails } from "@/lib/email/reminders";
import { appUrl, patientEmailByUserId } from "@/lib/email/recipients";
import { sendTransactionalEmail } from "@/lib/email/send";
import { formatOrderId } from "@/lib/orders/order-id";
import { recordPayment } from "@/lib/stripe/record-payment";
import { stripe } from "@/lib/stripe/server";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

const REUSABLE_PI_STATUSES = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
];

export type AdditionalPaymentIntent = {
  clientSecret: string;
  amountCents: number;
  reason: string | null;
  medicineName: string;
};

export type PendingAdditionalPaymentDto = {
  requestId: string;
  orderNumber: string;
  medicineId: string | null;
  subscriptionId: string | null;
  medicineName: string;
  amountCents: number;
  reason: string | null;
};

type AddPayRow = {
  id: string;
  request_id: string;
  amount_cents: number;
  currency: string;
  user_id: string | null;
  reason: string | null;
  status: string;
};

const ADD_PAY_COLS = "id, request_id, amount_cents, currency, user_id, reason, status";

function stripeCustomerId(pi: Stripe.PaymentIntent): string | null {
  const c = pi.customer;
  if (typeof c === "string") return c;
  return c?.id ?? null;
}

// Resolves (and, if needed, creates) the Stripe PaymentIntent for a request's pending Workflow C
// additional payment. Returns null when the order has no payment due or isn't the caller's.
export async function createAdditionalPaymentIntent(params: {
  userId: string;
  email: string | null;
  name: string | null;
  requestId: string;
}): Promise<AdditionalPaymentIntent | null> {
  const { userId, email, name, requestId } = params;

  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select("id, user_id, medicine_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.user_id !== userId) return null;

  const { data: pay } = await supabaseAdmin
    .from("additional_payments")
    .select("id, amount_cents, currency, reason, status, stripe_payment_intent_id")
    .eq("request_id", requestId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay) return null;

  const { data: med } = req.medicine_id
    ? await supabaseAdmin.from("medicines").select("name").eq("id", req.medicine_id).maybeSingle()
    : { data: null };
  const medicineName = (med as { name?: string } | null)?.name ?? "Medication";

  // Reuse an existing PaymentIntent (e.g. the patient refreshed the pay page) when it's still
  // payable; otherwise mint a fresh one. If Stripe already collected the money but our webhook
  // lagged, settle locally instead of charging again.
  if (pay.stripe_payment_intent_id) {
    try {
      const existing = await stripe.paymentIntents.retrieve(pay.stripe_payment_intent_id);
      if (existing.status === "succeeded") {
        await fulfillAdditionalPayment(existing);
        return null;
      }
      if (existing.client_secret && REUSABLE_PI_STATUSES.includes(existing.status)) {
        return {
          clientSecret: existing.client_secret,
          amountCents: pay.amount_cents,
          reason: pay.reason,
          medicineName,
        };
      }
    } catch {
      // Fall through and create a new one.
    }
  }

  const customerId = await getOrCreateStripeCustomer({ userId, email, name });

  const intent = await stripe.paymentIntents.create({
    amount: pay.amount_cents,
    currency: pay.currency ?? "usd",
    customer: customerId,
    description: pay.reason ?? `Additional payment for ${medicineName}`,
    payment_method_types: ["card"],
    metadata: {
      kind: "additional_payment",
      additional_payment_id: pay.id,
      request_id: requestId,
      user_id: userId,
    },
  });

  await supabaseAdmin
    .from("additional_payments")
    .update({ stripe_payment_intent_id: intent.id, updated_at: new Date().toISOString() })
    .eq("id", pay.id);

  return {
    clientSecret: intent.client_secret ?? "",
    amountCents: pay.amount_cents,
    reason: pay.reason,
    medicineName,
  };
}

async function findAdditionalPaymentRow(pi: Stripe.PaymentIntent): Promise<AddPayRow | null> {
  const metaId = (pi.metadata as Record<string, string> | undefined)?.additional_payment_id;

  const { data: byPi } = await supabaseAdmin
    .from("additional_payments")
    .select(ADD_PAY_COLS)
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  if (byPi && byPi.status !== "cancelled") return byPi as AddPayRow;

  if (metaId) {
    const { data: byMeta } = await supabaseAdmin
      .from("additional_payments")
      .select(ADD_PAY_COLS)
      .eq("id", metaId)
      .maybeSingle();
    if (byMeta && byMeta.status !== "cancelled") return byMeta as AddPayRow;
  }

  return null;
}

async function recordAdditionalCharge(row: AddPayRow, pi: Stripe.PaymentIntent): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  if (existing) return;

  const description = row.reason ?? "Additional payment";
  await recordPayment({
    user_id: row.user_id,
    stripe_payment_intent_id: pi.id,
    stripe_customer_id: stripeCustomerId(pi),
    amount_cents: row.amount_cents,
    currency: row.currency ?? "usd",
    status: "succeeded",
    raw_event: { lines: { data: [{ description }] } } as unknown as Json,
  });
}

async function advanceRequestAfterAdditionalPayment(requestId: string): Promise<void> {
  const { data: stillPending } = await supabaseAdmin
    .from("additional_payments")
    .select("id")
    .eq("request_id", requestId)
    .eq("status", "pending")
    .maybeSingle();
  if (stillPending) return;

  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (req?.status !== "awaiting_additional_payment") return;

  await supabaseAdmin
    .from("medication_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  const { data: existingEvent } = await supabaseAdmin
    .from("medication_request_events")
    .select("id")
    .eq("request_id", requestId)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  if (existingEvent) return;

  await supabaseAdmin.from("medication_request_events").insert({
    request_id: requestId,
    status: "approved",
    actor_role: "system",
    note: "Additional payment received.",
  });
}

async function notifyAdditionalPaymentReceived(row: AddPayRow): Promise<void> {
  try {
    const patient = await patientEmailByUserId(row.user_id);
    if (!patient) return;
    const { subject, html } = additionalPaymentReceivedEmail({
      fullName: patient.fullName,
      amountCents: row.amount_cents,
      currency: row.currency ?? "usd",
      myMedsUrl: `${appUrl()}/my-meds`,
    });
    await sendTransactionalEmail({ to: patient.email, subject, html });
  } catch (error) {
    console.error("[email] additional payment notify failed:", error);
  }
}

// Workflow C: a patient paid the price difference for a changed medicine. Idempotent so a
// Stripe webhook retry, the return-URL reconcile, and a later My Meds load all settle the
// same PaymentIntent without getting stuck on awaiting_additional_payment.
export async function fulfillAdditionalPayment(pi: Stripe.PaymentIntent): Promise<boolean> {
  if (pi.status !== "succeeded") return false;

  const row = await findAdditionalPaymentRow(pi);
  if (!row) return false;

  const becamePaid = row.status === "pending";
  if (becamePaid) {
    await supabaseAdmin
      .from("additional_payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: pi.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  try {
    await recordAdditionalCharge(row, pi);
  } catch (error) {
    console.error("[payments] additional payment record failed:", error);
  }

  await advanceRequestAfterAdditionalPayment(row.request_id);

  if (becamePaid) {
    await notifyAdditionalPaymentReceived(row);
  }

  try {
    await sendUnsentOrderStatusEmails({ requestId: row.request_id });
  } catch (error) {
    console.error("[email] additional payment status flush failed:", error);
  }

  return true;
}

export async function fulfillAdditionalPaymentByIntentId(
  paymentIntentId: string,
): Promise<boolean> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    return fulfillAdditionalPayment(pi);
  } catch (error) {
    console.error("[stripe] retrieve additional payment intent failed:", error);
    return false;
  }
}

type PendingPayRow = {
  request_id: string;
  amount_cents: number;
  reason: string | null;
  stripe_payment_intent_id: string | null;
};

async function mapPendingAdditionalPayments(
  rows: PendingPayRow[],
): Promise<PendingAdditionalPaymentDto[]> {
  if (rows.length === 0) return [];

  const requestIds = [...new Set(rows.map((p) => p.request_id))];
  const { data: requests } = await supabaseAdmin
    .from("medication_requests")
    .select("id, medicine_id, subscription_id")
    .in("id", requestIds);

  const medicineIds = [
    ...new Set(
      (requests ?? []).map((r) => r.medicine_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: meds } = medicineIds.length
    ? await supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
    : { data: [] as { id: string; name: string }[] };

  const reqById = new Map((requests ?? []).map((r) => [r.id, r]));
  const medById = new Map((meds ?? []).map((m) => [m.id, m.name]));

  return rows.map((p) => {
    const req = reqById.get(p.request_id);
    return {
      requestId: p.request_id,
      orderNumber: formatOrderId(p.request_id),
      medicineId: req?.medicine_id ?? null,
      subscriptionId: req?.subscription_id ?? null,
      medicineName: (req?.medicine_id ? medById.get(req.medicine_id) : null) ?? "Medication",
      amountCents: p.amount_cents,
      reason: p.reason,
    };
  });
}

// Pull Stripe truth for this patient's pending additional charges so My Meds / dashboard
// don't stay on "Additional payment required" when the webhook is delayed or missed.
export async function maybeReconcileAdditionalPayments(userId: string): Promise<boolean> {
  const { data: pending, error } = await supabaseAdmin
    .from("additional_payments")
    .select("id, stripe_payment_intent_id")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) {
    console.error("[stripe] maybeReconcileAdditionalPayments failed:", error.message);
    return false;
  }

  const intentIds = [
    ...new Set(
      (pending ?? [])
        .map((row) => row.stripe_payment_intent_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (intentIds.length === 0) return false;

  const results = await Promise.all(intentIds.map((id) => fulfillAdditionalPaymentByIntentId(id)));
  return results.some(Boolean);
}

export async function fetchPendingAdditionalPayments(
  userId: string,
): Promise<PendingAdditionalPaymentDto[]> {
  const { data: pays, error } = await supabaseAdmin
    .from("additional_payments")
    .select("request_id, amount_cents, reason, stripe_payment_intent_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return mapPendingAdditionalPayments(pays ?? []);
}

/** One pending-payments round trip, then Stripe only when a PaymentIntent is already on file. */
export async function healAndFetchPendingAdditionalPayments(
  userId: string,
): Promise<PendingAdditionalPaymentDto[]> {
  const { data: pays, error } = await supabaseAdmin
    .from("additional_payments")
    .select("request_id, amount_cents, reason, stripe_payment_intent_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[additional_payments] pending load failed:", error.message);
    return [];
  }

  const rows = pays ?? [];
  const intentIds = [
    ...new Set(
      rows.map((row) => row.stripe_payment_intent_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (intentIds.length === 0) {
    return mapPendingAdditionalPayments(rows);
  }

  const healed = (
    await Promise.all(intentIds.map((id) => fulfillAdditionalPaymentByIntentId(id)))
  ).some(Boolean);
  if (healed) return fetchPendingAdditionalPayments(userId);
  return mapPendingAdditionalPayments(rows);
}
