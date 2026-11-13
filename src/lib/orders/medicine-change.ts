import "server-only";

import { sendUnsentOrderStatusEmails } from "@/lib/email/reminders";
import {
  cancelPendingAdditionalCharge,
  sendMedicineChangeToPharmacy,
} from "@/lib/orders/additional-payment";
import { formatOrderId } from "@/lib/orders/order-id";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PendingMedicineConsent = {
  requestId: string;
  orderNumber: string;
  medicineName: string;
  creditCents: number;
};

/** Orders waiting for the patient to approve or reject a change that costs nothing extra. */
export async function fetchPendingMedicineConsents(
  userId: string,
): Promise<PendingMedicineConsent[]> {
  const { data: requests, error } = await supabaseAdmin
    .from("medication_requests")
    .select("id, medicine_id, plan_change_delta_cents")
    .eq("user_id", userId)
    .eq("status", "awaiting_additional_payment")
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error || !requests?.length) return [];

  const ids = requests.map((row) => row.id);
  const { data: payments } = await supabaseAdmin
    .from("additional_payments")
    .select("request_id, amount_cents")
    .in("request_id", ids)
    .eq("status", "pending");
  const due = new Set(
    (payments ?? []).filter((row) => row.amount_cents > 0).map((row) => row.request_id),
  );
  const waiting = requests.filter(
    (row) => !due.has(row.id) && (row.plan_change_delta_cents ?? 0) <= 0,
  );
  if (waiting.length === 0) return [];

  const medicineIds = [
    ...new Set(waiting.map((row) => row.medicine_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: medicines } = medicineIds.length
    ? await supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
    : { data: [] };
  const nameById = new Map((medicines ?? []).map((row) => [row.id, row.name]));

  return waiting.map((row) => {
    const delta = row.plan_change_delta_cents ?? 0;
    return {
      requestId: row.id,
      orderNumber: formatOrderId(row.id),
      medicineName: (row.medicine_id && nameById.get(row.medicine_id)) || "your treatment",
      creditCents: delta < 0 ? Math.abs(delta) : 0,
    };
  });
}

export type MedicineChangeView = {
  requestId: string;
  medicineName: string;
  planName: string | null;
  orderNumber: string;
  mode: "payment" | "consent" | "closed";
  amountCents: number;
  creditCents: number;
  deadline: string | null;
};

function isShippingPrice(price: {
  metadata?: { kind?: string } | null;
  lookup_key?: string | null;
}): boolean {
  return (
    price.metadata?.kind === "shipping" ||
    (typeof price.lookup_key === "string" && price.lookup_key.startsWith("bi_shipping_"))
  );
}

/** Switch the saved plan to the new package and credit a cheaper medicine on the next bill. */
async function applyConfirmedPlanBilling(req: {
  user_id: string | null;
  package_id: string | null;
  subscription_id: string | null;
  plan_change_delta_cents: number | null;
}): Promise<string | null> {
  let customerId: string | null = null;
  let billingNote: string | null = null;

  if (req.subscription_id && req.package_id) {
    const [{ data: sub }, { data: pkg }] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("id, stripe_subscription_id, stripe_customer_id")
        .eq("id", req.subscription_id)
        .maybeSingle(),
      supabaseAdmin
        .from("packages")
        .select("id, medicine_id, variant_id, stripe_price_id")
        .eq("id", req.package_id)
        .maybeSingle(),
    ]);
    customerId = sub?.stripe_customer_id ?? null;

    if (sub?.stripe_subscription_id && pkg?.stripe_price_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        const stripeCustomer = stripeSub.customer;
        customerId =
          (typeof stripeCustomer === "string" ? stripeCustomer : stripeCustomer?.id) ?? customerId;
        const planItem = stripeSub.items.data.find((item) => !isShippingPrice(item.price));
        if (!planItem) {
          billingNote =
            "The saved subscription has no plan to update, so the next bill was not changed.";
        } else if (planItem.price.id !== pkg.stripe_price_id) {
          await stripe.subscriptions.update(sub.stripe_subscription_id, {
            proration_behavior: "none",
            items: [{ id: planItem.id, price: pkg.stripe_price_id }],
            metadata: {
              ...stripeSub.metadata,
              medicine_id: pkg.medicine_id,
              package_id: pkg.id,
              variant_id: pkg.variant_id ?? "",
            },
          });
        }
        const { error: subError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            medicine_id: pkg.medicine_id,
            package_id: pkg.id,
            stripe_price_id: pkg.stripe_price_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
        if (subError) {
          console.error("[medicine-change] subscription update failed:", subError.message);
          billingNote = billingNote ?? "The next bill could not be updated.";
        }
      } catch (error) {
        console.error("[medicine-change] stripe plan update failed:", error);
        billingNote =
          "The saved Stripe subscription could not be updated, so the next bill was not changed.";
      }
    }
  }

  if (!customerId && req.user_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", req.user_id)
      .maybeSingle();
    customerId = profile?.stripe_customer_id ?? null;
  }

  const delta = Number(req.plan_change_delta_cents ?? 0);
  if (delta < 0 && customerId) {
    try {
      await stripe.customers.createBalanceTransaction(customerId, {
        amount: delta,
        currency: "usd",
        description: "Credit for a confirmed plan change (settles next cycle)",
      });
    } catch (error) {
      console.error("[medicine-change] credit failed:", error);
      billingNote = billingNote ?? "The lower price could not be credited in Stripe.";
    }
  } else if (delta < 0) {
    billingNote =
      billingNote ??
      "The lower price could not be credited because Stripe has no customer for this patient.";
  }

  return billingNote;
}

export async function loadMedicineChange(
  userId: string,
  requestId: string,
): Promise<MedicineChangeView | null> {
  const { data: request } = await supabaseAdmin
    .from("medication_requests")
    .select(
      "id, user_id, status, medicine_id, package_id, plan_change_deadline, plan_change_delta_cents",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.user_id !== userId) return null;

  const [{ data: medicine }, { data: plan }, { data: payment }] = await Promise.all([
    request.medicine_id
      ? supabaseAdmin.from("medicines").select("name").eq("id", request.medicine_id).maybeSingle()
      : Promise.resolve({ data: null }),
    request.package_id
      ? supabaseAdmin.from("packages").select("name").eq("id", request.package_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("additional_payments")
      .select("amount_cents")
      .eq("request_id", requestId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const delta = request.plan_change_delta_cents ?? 0;
  const amountCents =
    payment && payment.amount_cents > 0 ? payment.amount_cents : delta > 0 ? delta : 0;
  const open = request.status === "awaiting_additional_payment";
  const mode: MedicineChangeView["mode"] = !open
    ? "closed"
    : amountCents > 0
      ? "payment"
      : "consent";

  return {
    requestId: request.id,
    medicineName: medicine?.name?.trim() || "your treatment",
    planName: plan?.name?.trim() || null,
    orderNumber: formatOrderId(request.id),
    mode,
    amountCents,
    creditCents: delta < 0 ? Math.abs(delta) : 0,
    deadline: request.plan_change_deadline,
  };
}

export async function respondToMedicineChangeForPatient(params: {
  userId: string;
  requestId: string;
  decision: "approve" | "decline";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: request } = await supabaseAdmin
    .from("medication_requests")
    .select("id, user_id, status, plan_change_delta_cents")
    .eq("id", params.requestId)
    .maybeSingle();
  if (!request || request.user_id !== params.userId) {
    return { ok: false, message: "This change could not be found." };
  }
  if (request.status !== "awaiting_additional_payment") {
    return { ok: false, message: "This change has already been answered." };
  }

  const delta = request.plan_change_delta_cents ?? 0;
  if (params.decision === "approve") {
    if (delta > 0) {
      return { ok: false, message: "This change needs the additional payment." };
    }
    return approveMedicineChangeLocally({
      userId: params.userId,
      requestId: params.requestId,
    });
  }

  await cancelPendingAdditionalCharge(params.userId, params.requestId);
  return declineMedicineChangeLocally({
    userId: params.userId,
    requestId: params.requestId,
  });
}

/** Restore the previous medicine here. The provider app route is not required. */
async function declineMedicineChangeLocally(params: {
  userId: string;
  requestId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: request, error } = await supabaseAdmin
    .from("medication_requests")
    .select(
      "id, status, provider_id, user_id, plan_change_delta_cents, previous_medicine_id, previous_variant_id, previous_package_id",
    )
    .eq("id", params.requestId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error || !request) return { ok: false, message: "This change could not be found." };
  if (request.status !== "awaiting_additional_payment") {
    return { ok: false, message: "This change has already been answered." };
  }

  const now = new Date().toISOString();
  const { error: paymentError } = await supabaseAdmin
    .from("additional_payments")
    .update({ status: "cancelled", updated_at: now })
    .eq("request_id", params.requestId)
    .eq("status", "pending");
  if (paymentError) {
    console.error("[medicine-change] cancel pending charge failed:", paymentError.message);
    return { ok: false, message: "This choice could not be saved. Please try again." };
  }

  const restore =
    request.previous_package_id != null || request.previous_medicine_id != null
      ? {
          medicine_id: request.previous_medicine_id,
          variant_id: request.previous_variant_id,
          package_id: request.previous_package_id,
        }
      : {};
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("medication_requests")
    .update({
      ...restore,
      status: "pending_review",
      plan_change_token: null,
      plan_change_deadline: null,
      plan_change_delta_cents: null,
      previous_medicine_id: null,
      previous_variant_id: null,
      previous_package_id: null,
      updated_at: now,
    })
    .eq("id", params.requestId)
    .eq("user_id", params.userId)
    .eq("status", "awaiting_additional_payment")
    .select("id");
  if (updateError) {
    console.error("[medicine-change] restore previous plan failed:", updateError.message);
    return { ok: false, message: "This choice could not be saved. Please try again." };
  }
  if (!updated?.length) {
    return { ok: false, message: "This change has already been answered." };
  }

  const owedMoney = Number(request.plan_change_delta_cents ?? 0) > 0;
  const note = owedMoney
    ? "Patient declined the additional payment. The previous medicine and plan were restored, and the patient was not charged."
    : "Patient declined the medicine change. The previous medicine and plan were restored, and the patient was not charged.";

  const { error: eventError } = await supabaseAdmin.from("medication_request_events").insert({
    request_id: params.requestId,
    status: "pending_review",
    actor_role: "patient",
    created_by: params.userId,
    note,
  });
  if (eventError) console.error("[medicine-change] decline event failed:", eventError.message);

  if (request.provider_id) {
    const { error: notifyError } = await supabaseAdmin.from("notifications").insert({
      user_id: request.provider_id,
      type: "plan_change_declined",
      title: owedMoney
        ? "Patient declined the additional payment"
        : "Patient declined the medicine change",
      body: note,
      link: `/provider/requests/${params.requestId}`,
      entity_id: params.requestId,
    });
    if (notifyError)
      console.error("[medicine-change] provider notify failed:", notifyError.message);
  }

  return { ok: true };
}

/** Confirm a no-extra-due medicine change here. The provider app route is not required. */
async function approveMedicineChangeLocally(params: {
  userId: string;
  requestId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: request, error } = await supabaseAdmin
    .from("medication_requests")
    .select(
      "id, status, provider_id, user_id, medicine_id, package_id, subscription_id, plan_change_delta_cents",
    )
    .eq("id", params.requestId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error || !request) return { ok: false, message: "This change could not be found." };
  if (request.status !== "awaiting_additional_payment") {
    return { ok: false, message: "This change has already been answered." };
  }
  if (Number(request.plan_change_delta_cents ?? 0) > 0) {
    return { ok: false, message: "This change needs the additional payment." };
  }

  const { data: pendingPay } = await supabaseAdmin
    .from("additional_payments")
    .select("amount_cents")
    .eq("request_id", params.requestId)
    .eq("status", "pending")
    .gt("amount_cents", 0)
    .limit(1)
    .maybeSingle();
  if (pendingPay) {
    return { ok: false, message: "This change needs the additional payment." };
  }

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("medication_requests")
    .update({
      status: "approved",
      plan_change_token: null,
      plan_change_deadline: null,
      updated_at: now,
    })
    .eq("id", params.requestId)
    .eq("user_id", params.userId)
    .eq("status", "awaiting_additional_payment")
    .select("id");
  if (claimError) {
    console.error("[medicine-change] approve claim failed:", claimError.message);
    return { ok: false, message: "This choice could not be saved. Please try again." };
  }
  if (!claimed?.length) {
    return { ok: false, message: "This change has already been answered." };
  }

  await supabaseAdmin
    .from("additional_payments")
    .update({ status: "cancelled", updated_at: now })
    .eq("request_id", params.requestId)
    .eq("status", "pending");

  const billingNote = await applyConfirmedPlanBilling(request);
  const sent = await sendMedicineChangeToPharmacy(
    params.requestId,
    "Patient approved the medicine change. Prescription generated.",
  );

  if (billingNote) {
    await supabaseAdmin.from("medication_request_events").insert({
      request_id: params.requestId,
      status: sent.sent ? "sent_to_pharmacy" : "approved",
      actor_role: "system",
      created_by: null,
      note: `${billingNote} The prescription was still processed.`.slice(0, 500),
    });
  }

  const note = sent.error
    ? `Patient approved the medicine change. The pharmacy send did not go through: ${sent.error}`
    : "Patient approved the medicine change. The prescription was sent to the pharmacy.";
  if (request.provider_id) {
    const { error: notifyError } = await supabaseAdmin.from("notifications").insert({
      user_id: request.provider_id,
      type: "plan_change_confirmed",
      title: sent.error ? "Pharmacy send needs attention" : "Prescription sent to the pharmacy",
      body: note.slice(0, 500),
      link: `/provider/requests/${params.requestId}`,
      entity_id: params.requestId,
    });
    if (notifyError) {
      console.error("[medicine-change] provider notify failed:", notifyError.message);
    }
  }

  try {
    await sendUnsentOrderStatusEmails({ requestId: params.requestId });
  } catch (emailError) {
    console.error("[medicine-change] status email failed:", emailError);
  }

  return { ok: true };
}
