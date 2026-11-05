import "server-only";

import type Stripe from "stripe";

import { additionalPaymentReceivedEmail } from "@/lib/email/lifecycle-emails";
import { submitRequestToLifeFile } from "@/lib/lifefile/submit.server";
import { sendOnce } from "@/lib/email/idempotency";
import { sendUnsentOrderStatusEmails } from "@/lib/email/reminders";
import { appUrl, patientEmailByUserId } from "@/lib/email/recipients";
import { sendTransactionalEmail } from "@/lib/email/send";
import { formatOrderId } from "@/lib/orders/order-id";
import { recordPayment } from "@/lib/stripe/record-payment";
import { incrementPromoRedemption, resolveCheckoutDiscount } from "@/lib/stripe/promos";
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

const REUSABLE_SETUP_STATUSES = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
];

export type AdditionalPaymentIntent = {
  clientSecret: string;
  amountCents: number;
  originalAmountCents: number;
  discountCents: number;
  promoLabel: string | null;
  reason: string | null;
  medicineName: string;
};

export type AdditionalPaymentDiscountResult =
  | {
      ok: true;
      waived: boolean;
      completed: boolean;
      clientSecret: string | null;
      amountCents: number;
      originalAmountCents: number;
      discountCents: number;
      label: string;
    }
  | { ok: false; message: string };

const CARD_MINIMUM_CENTS = 50;

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
  to_package_id: string | null;
};

const ADD_PAY_COLS =
  "id, request_id, amount_cents, currency, user_id, reason, status, to_package_id";

function stripeCustomerId(pi: Stripe.PaymentIntent): string | null {
  const c = pi.customer;
  if (typeof c === "string") return c;
  return c?.id ?? null;
}

function pricingFromIntent(originalCents: number, pi: Stripe.PaymentIntent | null) {
  const discountCents = Number(pi?.metadata?.discount_cents ?? 0);
  const promoLabel = pi?.metadata?.promo_code?.trim() || null;
  const discounted =
    Boolean(promoLabel) && Number.isFinite(discountCents) && discountCents > 0 && Boolean(pi);
  return {
    amountCents: discounted && pi ? pi.amount : originalCents,
    originalAmountCents: originalCents,
    discountCents: discounted ? discountCents : 0,
    promoLabel: discounted ? promoLabel : null,
  };
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
  if (pay.stripe_payment_intent_id && !pay.stripe_payment_intent_id.startsWith("seti_")) {
    try {
      const existing = await stripe.paymentIntents.retrieve(pay.stripe_payment_intent_id);
      if (existing.status === "succeeded") {
        await fulfillAdditionalPayment(existing);
        return null;
      }
      if (existing.client_secret && REUSABLE_PI_STATUSES.includes(existing.status)) {
        return {
          clientSecret: existing.client_secret,
          reason: pay.reason,
          medicineName,
          ...pricingFromIntent(pay.amount_cents, existing),
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
    reason: pay.reason,
    medicineName,
    ...pricingFromIntent(pay.amount_cents, intent),
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

async function recordAdditionalCharge(
  row: AddPayRow,
  charge: {
    amountCents: number;
    stripePaymentIntentId: string | null;
    stripeCustomerId: string | null;
    promoCode: string | null;
  },
): Promise<void> {
  if (charge.stripePaymentIntentId) {
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", charge.stripePaymentIntentId)
      .maybeSingle();
    if (existing) return;
  } else {
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .contains("raw_event", { additional_payment_id: row.id })
      .limit(1)
      .maybeSingle();
    if (existing) return;
  }

  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select("package_id")
    .eq("id", row.request_id)
    .maybeSingle();

  const description = row.reason ?? "Additional payment";
  const lines = [{ description }];
  if (charge.promoCode) lines.push({ description: `Discount (${charge.promoCode})` });
  // A normal card charge keeps the previous raw event shape. A promo or a fully
  // covered charge adds an id so a retry can find the same billing row.
  const rawEvent = charge.promoCode
    ? { additional_payment_id: row.id, lines: { data: lines } }
    : { lines: { data: lines } };

  await recordPayment(
    {
      user_id: row.user_id,
      plan_id: row.to_package_id ?? req?.package_id ?? null,
      // Leave the subscription off this row. The payment trigger opens a medication
      // request for every succeeded payment that carries a subscription id, which
      // duplicated the same medicine after this extra charge.
      stripe_payment_intent_id: charge.stripePaymentIntentId,
      stripe_customer_id: charge.stripeCustomerId,
      amount_cents: charge.amountCents,
      currency: row.currency ?? "usd",
      status: "succeeded",
      raw_event: rawEvent as unknown as Json,
    },
    { settle: false },
  );
}

async function ensurePrescription(
  requestId: string,
  req: {
    user_id: string | null;
    provider_id: string | null;
    medicine_id: string | null;
    variant_id: string | null;
    package_id: string | null;
  },
): Promise<void> {
  let packageId = req.package_id;
  if (!packageId) {
    const { data: pay } = await supabaseAdmin
      .from("additional_payments")
      .select("to_package_id")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    packageId = pay?.to_package_id ?? null;
  }

  let existingQuery = supabaseAdmin.from("prescriptions").select("id").eq("request_id", requestId);
  if (req.medicine_id) existingQuery = existingQuery.eq("medicine_id", req.medicine_id);
  const { data: existingRx } = await existingQuery.limit(1).maybeSingle();
  if (existingRx) return;

  const { data: med } = req.medicine_id
    ? await supabaseAdmin.from("medicines").select("name").eq("id", req.medicine_id).maybeSingle()
    : { data: null };

  const { error } = await supabaseAdmin.from("prescriptions").insert({
    request_id: requestId,
    user_id: req.user_id,
    provider_id: req.provider_id,
    medicine_id: req.medicine_id,
    variant_id: req.variant_id,
    package_id: packageId,
    medicine_name: (med as { name?: string } | null)?.name ?? "Medication",
    status: "generated",
  });
  if (error) console.error("[additional-payment] prescription insert failed:", error.message);
}

// Payment of a medicine-change difference generates the prescription in this portal.
async function prescribeRequestAfterAdditionalPayment(requestId: string): Promise<void> {
  const { data: stillPending } = await supabaseAdmin
    .from("additional_payments")
    .select("id")
    .eq("request_id", requestId)
    .eq("status", "pending")
    .maybeSingle();
  if (stillPending) return;

  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select("id, status, user_id, provider_id, medicine_id, variant_id, package_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return;

  if (!["awaiting_additional_payment", "approved", "prescribed"].includes(req.status)) return;

  await ensurePrescription(requestId, req);
  if (req.status === "prescribed") return;

  const { data: updated } = await supabaseAdmin
    .from("medication_requests")
    .update({ status: "prescribed", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["awaiting_additional_payment", "approved"])
    .select("id");
  if (!updated?.length) return;

  const { data: existingEvent } = await supabaseAdmin
    .from("medication_request_events")
    .select("id")
    .eq("request_id", requestId)
    .eq("status", "prescribed")
    .limit(1)
    .maybeSingle();
  if (existingEvent) return;

  await supabaseAdmin.from("medication_request_events").insert({
    request_id: requestId,
    status: "prescribed",
    actor_role: "system",
    note: "Additional payment received. Prescription generated.",
  });
}

async function markSentToPharmacy(requestId: string, note: string): Promise<void> {
  const { data: updated } = await supabaseAdmin
    .from("medication_requests")
    .update({ status: "sent_to_pharmacy", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["prescribed", "sent_to_pharmacy"])
    .select("id");
  if (!updated?.length) return;

  const { data: existingEvent } = await supabaseAdmin
    .from("medication_request_events")
    .select("id")
    .eq("request_id", requestId)
    .eq("status", "sent_to_pharmacy")
    .limit(1)
    .maybeSingle();
  if (existingEvent) {
    await supabaseAdmin
      .from("medication_request_events")
      .update({ note })
      .eq("id", existingEvent.id);
    return;
  }

  await supabaseAdmin.from("medication_request_events").insert({
    request_id: requestId,
    status: "sent_to_pharmacy",
    actor_role: "system",
    note,
  });
}

// An unpaid difference blocks fulfillment. Once it is paid, submit the same LifeFile
// order the admin app sends, and only then mark the request sent to the pharmacy.
async function prescribeAndSendToPharmacy(requestId: string): Promise<void> {
  const { data: stillPending } = await supabaseAdmin
    .from("additional_payments")
    .select("id")
    .eq("request_id", requestId)
    .eq("status", "pending")
    .maybeSingle();
  if (stillPending) return;

  await prescribeRequestAfterAdditionalPayment(requestId);

  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select(
      "id, status, provider_id, user_id, medicine_id, variant_id, life_file_order_id, life_file_status",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return;
  if (req.life_file_order_id && req.life_file_status && req.life_file_status !== "failed") {
    await markSentToPharmacy(requestId, `Life File order ID: ${req.life_file_order_id}`);
    return;
  }

  try {
    const lf = await submitRequestToLifeFile(supabaseAdmin, req, { allowRetry: true });
    const pharmacy = lf.pharmacyName ? ` (${lf.pharmacyName})` : "";
    await markSentToPharmacy(requestId, `Life File order ID: ${lf.lifeFileOrderId}${pharmacy}`);
  } catch (error) {
    console.error("[lifefile] additional payment submission failed:", error);
  }
}

async function notifyAdditionalPaymentReceived(
  row: AddPayRow,
  chargedCents: number,
): Promise<void> {
  try {
    const patient = await patientEmailByUserId(row.user_id);
    if (!patient) return;
    const { subject, html } = additionalPaymentReceivedEmail({
      fullName: patient.fullName,
      amountCents: chargedCents,
      currency: row.currency ?? "usd",
      myMedsUrl: `${appUrl()}/my-meds`,
    });
    await sendOnce("additional_payment_received", row.id, () =>
      sendTransactionalEmail({ to: patient.email, subject, html }),
    );
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

  const promoCode = pi.metadata?.promo_code?.trim() || null;
  try {
    await recordAdditionalCharge(row, {
      amountCents: pi.amount,
      stripePaymentIntentId: pi.id,
      stripeCustomerId: stripeCustomerId(pi),
      promoCode,
    });
  } catch (error) {
    console.error("[payments] additional payment record failed:", error);
  }

  await prescribeAndSendToPharmacy(row.request_id);

  if (becamePaid) {
    await notifyAdditionalPaymentReceived(row, pi.amount);
    const promoId = pi.metadata?.promo_id?.trim();
    if (promoId) await incrementPromoRedemption(promoId);
  }

  try {
    await sendUnsentOrderStatusEmails({ requestId: row.request_id });
  } catch (error) {
    console.error("[email] additional payment status flush failed:", error);
  }

  return true;
}

/** Finish paid medicine-change orders that never reached "sent to pharmacy". Stays in this portal. */
export async function dispatchUnsentPaidUpgrades(userId: string): Promise<void> {
  const { data: pays, error } = await supabaseAdmin
    .from("additional_payments")
    .select(ADD_PAY_COLS)
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(10);
  if (error || !pays?.length) return;

  const requestIds = [...new Set(pays.map((row) => row.request_id))];
  const { data: requests } = await supabaseAdmin
    .from("medication_requests")
    .select("id, status, life_file_order_id, life_file_status")
    .in("id", requestIds);
  const needsLifeFile = new Set(
    (requests ?? [])
      .filter((row) => {
        if (["dispatched", "delivered", "rejected", "cancelled"].includes(row.status)) return false;
        const submitted = Boolean(
          row.life_file_order_id && row.life_file_status && row.life_file_status !== "failed",
        );
        if (submitted) return false;
        return (
          row.status === "sent_to_pharmacy" ||
          row.status === "prescribed" ||
          row.status === "approved"
        );
      })
      .map((row) => row.id),
  );

  for (const row of pays) {
    if (!needsLifeFile.has(row.request_id)) continue;
    needsLifeFile.delete(row.request_id);
    await prescribeAndSendToPharmacy(row.request_id);
  }
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

async function cancelOpenIntent(paymentIntentId: string | null): Promise<void> {
  if (!paymentIntentId) return;
  try {
    if (paymentIntentId.startsWith("seti_")) {
      const existing = await stripe.setupIntents.retrieve(paymentIntentId);
      if (REUSABLE_SETUP_STATUSES.includes(existing.status)) {
        await stripe.setupIntents.cancel(paymentIntentId);
      }
      return;
    }
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (REUSABLE_PI_STATUSES.includes(existing.status)) {
      await stripe.paymentIntents.cancel(paymentIntentId);
    }
  } catch (error) {
    console.error("[additional-payment] cancel intent failed:", error);
  }
}

async function loadOwnedPendingPayment(
  userId: string,
  requestId: string,
): Promise<
  | { ok: false; message: string }
  | { ok: true; pay: AddPayRow & { stripe_payment_intent_id: string | null } }
> {
  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select("id, user_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.user_id !== userId) {
    return { ok: false, message: "This payment could not be found." };
  }

  const { data: pay } = await supabaseAdmin
    .from("additional_payments")
    .select(`${ADD_PAY_COLS}, stripe_payment_intent_id`)
    .eq("request_id", requestId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay) return { ok: false, message: "There's no payment due on this order." };
  return { ok: true, pay: pay as AddPayRow & { stripe_payment_intent_id: string | null } };
}

export async function applyAdditionalPaymentDiscount(params: {
  userId: string;
  email: string | null;
  name: string | null;
  requestId: string;
  code: string;
}): Promise<AdditionalPaymentDiscountResult> {
  const code = params.code.trim();
  if (!code) return { ok: false, message: "Enter a promo code" };

  const loaded = await loadOwnedPendingPayment(params.userId, params.requestId);
  if (!loaded.ok) return { ok: false, message: loaded.message };
  const pay = loaded.pay;

  const discount = await resolveCheckoutDiscount({
    code,
    subtotalCents: pay.amount_cents,
    allowAuto: false,
  });
  if (!discount) return { ok: false, message: "Invalid or expired promo code" };

  const chargeCents = Math.max(0, pay.amount_cents - discount.discountCents);
  if (chargeCents > 0 && chargeCents < CARD_MINIMUM_CENTS) {
    return {
      ok: false,
      message:
        "This code leaves less than $0.50, which the card processor cannot charge. Use a code that covers the full balance, or a smaller discount.",
    };
  }

  if (chargeCents === 0) {
    await cancelOpenIntent(pay.stripe_payment_intent_id);
    const settled = await completeWaivedAdditionalPayment({
      userId: params.userId,
      requestId: params.requestId,
      code,
    });
    if (!settled.ok) return settled;
    return {
      ok: true,
      waived: true,
      completed: true,
      clientSecret: null,
      amountCents: 0,
      originalAmountCents: pay.amount_cents,
      discountCents: discount.discountCents,
      label: discount.label,
    };
  }

  const metadata = {
    kind: "additional_payment",
    additional_payment_id: pay.id,
    request_id: params.requestId,
    user_id: params.userId,
    promo_id: discount.promo.id,
    promo_code: discount.label,
    discount_cents: String(discount.discountCents),
    original_amount_cents: String(pay.amount_cents),
  };

  if (pay.stripe_payment_intent_id?.startsWith("seti_")) {
    await cancelOpenIntent(pay.stripe_payment_intent_id);
  } else if (pay.stripe_payment_intent_id) {
    try {
      const existing = await stripe.paymentIntents.retrieve(pay.stripe_payment_intent_id);
      if (existing.status === "succeeded") {
        await fulfillAdditionalPayment(existing);
        return { ok: false, message: "This payment was already completed." };
      }
      if (existing.client_secret && REUSABLE_PI_STATUSES.includes(existing.status)) {
        const updated = await stripe.paymentIntents.update(existing.id, {
          amount: chargeCents,
          metadata: { ...existing.metadata, ...metadata },
        });
        if (!updated.client_secret) {
          return { ok: false, message: "Unable to apply promo code. Please try again." };
        }
        return {
          ok: true,
          waived: false,
          completed: false,
          clientSecret: updated.client_secret,
          amountCents: chargeCents,
          originalAmountCents: pay.amount_cents,
          discountCents: discount.discountCents,
          label: discount.label,
        };
      }
    } catch (error) {
      console.error("[additional-payment] update intent amount failed:", error);
    }
  }

  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.email,
    name: params.name,
  });
  const intent = await stripe.paymentIntents.create({
    amount: chargeCents,
    currency: pay.currency ?? "usd",
    customer: customerId,
    description: pay.reason ?? "Additional payment",
    payment_method_types: ["card"],
    metadata,
  });
  if (!intent.client_secret) {
    return { ok: false, message: "Unable to apply promo code. Please try again." };
  }
  await supabaseAdmin
    .from("additional_payments")
    .update({ stripe_payment_intent_id: intent.id, updated_at: new Date().toISOString() })
    .eq("id", pay.id);

  return {
    ok: true,
    waived: false,
    completed: false,
    clientSecret: intent.client_secret,
    amountCents: chargeCents,
    originalAmountCents: pay.amount_cents,
    discountCents: discount.discountCents,
    label: discount.label,
  };
}

export async function completeWaivedAdditionalPayment(params: {
  userId: string;
  requestId: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const code = params.code.trim();
  if (!code) return { ok: false, message: "Enter a promo code" };

  const { data: req } = await supabaseAdmin
    .from("medication_requests")
    .select("id, user_id")
    .eq("id", params.requestId)
    .maybeSingle();
  if (!req || req.user_id !== params.userId) {
    return { ok: false, message: "This payment could not be found." };
  }

  const { data: pay } = await supabaseAdmin
    .from("additional_payments")
    .select(ADD_PAY_COLS)
    .eq("request_id", params.requestId)
    .in("status", ["pending", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay) return { ok: false, message: "There's no payment due on this order." };

  const row = pay as AddPayRow;
  if (row.status === "paid") {
    await prescribeAndSendToPharmacy(row.request_id);
    return { ok: true };
  }

  const discount = await resolveCheckoutDiscount({
    code,
    subtotalCents: row.amount_cents,
    allowAuto: false,
  });
  if (!discount) return { ok: false, message: "Invalid or expired promo code" };
  const chargeCents = Math.max(0, row.amount_cents - discount.discountCents);
  if (chargeCents !== 0) return { ok: false, message: "A payment is still due for this order." };

  const now = new Date().toISOString();
  const { data: marked } = await supabaseAdmin
    .from("additional_payments")
    .update({
      status: "paid",
      paid_at: now,
      stripe_payment_intent_id: null,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");

  if (!marked?.length) {
    await prescribeAndSendToPharmacy(row.request_id);
    return { ok: true };
  }

  try {
    await recordAdditionalCharge(row, {
      amountCents: 0,
      stripePaymentIntentId: null,
      stripeCustomerId: null,
      promoCode: discount.label,
    });
  } catch (error) {
    console.error("[payments] waived additional payment record failed:", error);
  }

  await prescribeAndSendToPharmacy(row.request_id);
  await notifyAdditionalPaymentReceived(row, 0);
  await incrementPromoRedemption(discount.promo.id);

  try {
    await sendUnsentOrderStatusEmails({ requestId: row.request_id });
  } catch (error) {
    console.error("[email] additional payment status flush failed:", error);
  }

  return { ok: true };
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
