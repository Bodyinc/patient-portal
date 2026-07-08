import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];

// Idempotent payment write keyed on the Stripe invoice, without depending on a DB unique
// index (an ON CONFLICT upsert throws if that index is missing). Safe to call from the
// webhook and the reconcile path for the same invoice.
export async function recordPayment(payment: PaymentInsert): Promise<void> {
  if (payment.stripe_invoice_id) {
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_invoice_id", payment.stripe_invoice_id)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("payments").update(payment).eq("id", existing.id);
      return;
    }
  }
  await supabaseAdmin.from("payments").insert(payment);
}
