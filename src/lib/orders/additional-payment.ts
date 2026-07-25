import "server-only";

import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customers";

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
  // payable; otherwise mint a fresh one.
  if (pay.stripe_payment_intent_id) {
    try {
      const existing = await stripe.paymentIntents.retrieve(pay.stripe_payment_intent_id);
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
