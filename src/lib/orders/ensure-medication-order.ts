import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

type PaymentRow = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  status: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  package_id: string | null;
  medicine_id: string | null;
};

async function resolveProviderId(params: {
  needsConsultation: boolean;
  userId: string | null;
  sessionId: string | null;
}): Promise<string | null> {
  let state: string | null = null;
  if (params.userId) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("state_code")
      .eq("id", params.userId)
      .maybeSingle();
    state = profile?.state_code ?? null;
  }
  if (!state && params.sessionId) {
    const { data: intake } = await supabaseAdmin
      .from("intake_sessions")
      .select("state_code")
      .eq("id", params.sessionId)
      .maybeSingle();
    state = intake?.state_code ?? null;
  }

  const { data: activeProviders } = await supabaseAdmin
    .from("providers")
    .select("id, license_states, is_default")
    .eq("is_active", true);

  type ProviderRow = { id: string; license_states: string[] | null; is_default: boolean };
  const providers = activeProviders ?? [];
  const defaultId = providers.find((p) => p.is_default)?.id ?? null;
  if (!params.needsConsultation) return defaultId;

  if (state) {
    const upper = state.toUpperCase();
    const hasStateProvider = providers.some((p) =>
      (p.license_states ?? []).some((s) => s.toUpperCase() === upper),
    );
    if (hasStateProvider) return null;
  }

  return defaultId;
}

async function loadPayment(params: {
  paymentId?: string;
  stripeInvoiceId?: string | null;
}): Promise<PaymentRow | null> {
  if (params.paymentId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, session_id, stripe_subscription_id, stripe_invoice_id, status")
      .eq("id", params.paymentId)
      .maybeSingle();
    return data ?? null;
  }
  if (params.stripeInvoiceId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, session_id, stripe_subscription_id, stripe_invoice_id, status")
      .eq("stripe_invoice_id", params.stripeInvoiceId)
      .maybeSingle();
    return data ?? null;
  }
  return null;
}

/**
 * App-level backstop for trg_create_medication_order — runs after payment INSERT/UPDATE
 * so orders exist even when the DB trigger did not fire (e.g. failed→succeeded update).
 */
export async function ensureMedicationOrderForPayment(params: {
  paymentId?: string;
  stripeInvoiceId?: string | null;
}): Promise<void> {
  const payment = await loadPayment(params);
  if (!payment) return;
  if (payment.status !== "succeeded" || !payment.stripe_subscription_id) return;

  if (payment.stripe_invoice_id) {
    const { data: existing } = await supabaseAdmin
      .from("medication_requests")
      .select("id")
      .eq("stripe_invoice_id", payment.stripe_invoice_id)
      .maybeSingle();
    if (existing) return;
  }

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, session_id, package_id, medicine_id")
    .eq("stripe_subscription_id", payment.stripe_subscription_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscription = sub as SubscriptionRow | null;
  if (!subscription?.id || !subscription.medicine_id) return;

  const { data: medicine } = await supabaseAdmin
    .from("medicines")
    .select("name, requires_consultation, requires_followup")
    .eq("id", subscription.medicine_id)
    .maybeSingle();
  if (!medicine) return;

  const { data: priorRequest } = await supabaseAdmin
    .from("medication_requests")
    .select("id")
    .eq("subscription_id", subscription.id)
    .limit(1)
    .maybeSingle();

  const kind = priorRequest ? "followup" : "initial";
  const needsConsultation = priorRequest
    ? Boolean(medicine.requires_followup)
    : Boolean(medicine.requires_consultation);
  let status = needsConsultation ? "pending_review" : "approved";

  const providerId = await resolveProviderId({
    needsConsultation,
    userId: subscription.user_id ?? payment.user_id,
    sessionId: subscription.session_id ?? payment.session_id,
  });

  let variantId: string | null = null;
  if (subscription.package_id) {
    const { data: pkg } = await supabaseAdmin
      .from("packages")
      .select("variant_id")
      .eq("id", subscription.package_id)
      .maybeSingle();
    variantId = pkg?.variant_id ?? null;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("medication_requests")
    .insert({
      user_id: subscription.user_id ?? payment.user_id,
      session_id: subscription.session_id ?? payment.session_id,
      subscription_id: subscription.id,
      payment_id: payment.id,
      stripe_invoice_id: payment.stripe_invoice_id,
      medicine_id: subscription.medicine_id,
      variant_id: variantId,
      package_id: subscription.package_id,
      provider_id: providerId,
      kind,
      status,
      requires_consultation: needsConsultation,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (/duplicate|unique/i.test(insertError.message)) return;
    console.error("[orders] ensureMedicationOrderForPayment insert failed:", insertError.message);
    return;
  }

  const requestId = inserted?.id;
  if (!requestId) return;

  await supabaseAdmin.from("medication_request_events").insert({
    request_id: requestId,
    status: "payment_completed",
    actor_role: "system",
  });

  if (providerId) {
    await supabaseAdmin.from("medication_request_events").insert({
      request_id: requestId,
      status: "provider_assigned",
      actor_role: "system",
    });
  }

  await supabaseAdmin.from("medication_request_events").insert({
    request_id: requestId,
    status,
    actor_role: "system",
  });

  if (status === "approved") {
    await supabaseAdmin.from("prescriptions").insert({
      request_id: requestId,
      user_id: subscription.user_id ?? payment.user_id,
      provider_id: providerId,
      medicine_id: subscription.medicine_id,
      variant_id: variantId,
      package_id: subscription.package_id,
      medicine_name: medicine.name,
      status: "generated",
    });
    status = "prescribed";
    await supabaseAdmin
      .from("medication_requests")
      .update({ status: "prescribed", updated_at: new Date().toISOString() })
      .eq("id", requestId);
    await supabaseAdmin.from("medication_request_events").insert({
      request_id: requestId,
      status: "prescribed",
      actor_role: "system",
    });
  }
}
