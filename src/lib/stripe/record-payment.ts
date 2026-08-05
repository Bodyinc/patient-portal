import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureMedicationOrderForPayment } from "@/lib/orders/ensure-medication-order";
import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import type { Database } from "@/lib/supabase/types";

type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];

// Runs after the order row exists (trigger- or app-created). Never let a mail failure fail the
// payment write — Stripe would retry the whole webhook event.
async function settleOrder(paymentId: string): Promise<void> {
  await ensureMedicationOrderForPayment({ paymentId });
  try {
    await sendOrderConfirmationEmail(paymentId);
  } catch (error) {
    console.error("[email] order confirmation failed:", error);
  }
}

// Idempotent payment write keyed on the Stripe invoice, without depending on a DB unique
// index (an ON CONFLICT upsert throws if that index is missing). Safe to call from the
// webhook and the reconcile path for the same invoice.
export async function recordPayment(payment: PaymentInsert): Promise<string | null> {
  if (payment.stripe_invoice_id) {
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_invoice_id", payment.stripe_invoice_id)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("payments").update(payment).eq("id", existing.id);
      if (payment.status === "succeeded") {
        await settleOrder(existing.id);
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
  if (paymentId && payment.status === "succeeded") {
    await settleOrder(paymentId);
  }
  return paymentId;
}
