import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureMedicationOrderForPayment } from "@/lib/orders/ensure-medication-order";
import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import { sendAdminNewRequestEmail } from "@/lib/email/admin-request-email";
import type { Database } from "@/lib/supabase/types";

type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];

// Runs after the order row exists (trigger- or app-created). Never let a mail failure fail the
// payment write — Stripe would retry the whole webhook event.
// Patient mail at checkout is only the combined payment + order confirmation.
async function settleOrder(paymentId: string, opts?: { sendPatientMail?: boolean }): Promise<void> {
  await ensureMedicationOrderForPayment({ paymentId });
  if (opts?.sendPatientMail !== false) {
    try {
      await sendOrderConfirmationEmail(paymentId);
    } catch (error) {
      console.error("[email] order confirmation failed:", error);
    }
  }
  try {
    await sendAdminNewRequestEmail(paymentId);
  } catch (error) {
    console.error("[email] admin new-request failed:", error);
  }
}

export async function recordPayment(
  payment: PaymentInsert,
  opts?: { sendPatientMail?: boolean; settle?: boolean },
): Promise<string | null> {
  const shouldSettle = opts?.settle !== false && payment.status === "succeeded";

  if (payment.stripe_invoice_id) {
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_invoice_id", payment.stripe_invoice_id)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("payments").update(payment).eq("id", existing.id);
      if (shouldSettle) {
        await settleOrder(existing.id, opts);
      }
      return existing.id;
    }
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("payments")
    .insert(payment)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[payments] recordPayment insert failed:", error.message);
    return null;
  }

  const paymentId = inserted?.id ?? null;
  if (paymentId && shouldSettle) {
    await settleOrder(paymentId, opts);
  }
  return paymentId;
}
