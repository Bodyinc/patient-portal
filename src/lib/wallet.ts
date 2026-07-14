import "server-only";

import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type WalletTransactionType = "referral_reward" | "payment_applied" | "admin_adjustment";

export type WalletTransaction = {
  id: string;
  amount_cents: number;
  type: string;
  description: string | null;
  created_at: string;
};

export type WalletSummary = {
  balanceCents: number;
  transactions: WalletTransaction[];
};

export async function recordWalletTransaction(params: {
  userId: string;
  amountCents: number;
  type: WalletTransactionType;
  description?: string | null;
  referralId?: string | null;
  stripeInvoiceId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("wallet_transactions").insert({
    user_id: params.userId,
    amount_cents: params.amountCents,
    type: params.type,
    description: params.description ?? null,
    referral_id: params.referralId ?? null,
    stripe_invoice_id: params.stripeInvoiceId ?? null,
    created_by: params.createdBy ?? null,
  });
  // 23505 = the unique (user, invoice, type) guard: webhook and reconcile both try
  // to record the same debit — first writer wins.
  if (error && error.code !== "23505") {
    console.error("[wallet] transaction record failed:", error.message);
  }
}

// Balance = ledger sum, NOT a live Stripe call — keeps the billing page off the
// Stripe API (~300-600ms/view). Checkout still reads the real Stripe balance via
// getCustomerCreditCents, since that's what determines the actual charge.
// Fail-soft so pages render before the migration is applied.
export async function getWalletSummary(userId: string): Promise<WalletSummary | null> {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id, amount_cents, type, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const all = rows ?? [];
    const balanceCents = Math.max(
      0,
      all.reduce((sum, t) => sum + (t.amount_cents ?? 0), 0),
    );
    return { balanceCents, transactions: all.slice(0, 20) };
  } catch (error) {
    console.warn("[wallet] summary unavailable:", error);
    return null;
  }
}

// When Stripe consumes customer balance on an invoice, mirror it as a wallet debit.
// starting/ending balance are negative while credit exists; consumption is the rise
// toward zero (e.g. -5000 -> 0 consumed 5000).
export async function recordInvoiceWalletDebit(
  invoice: Stripe.Invoice,
  userId: string,
): Promise<void> {
  const anyInv = invoice as unknown as {
    starting_balance?: number | null;
    ending_balance?: number | null;
  };
  const consumed = (anyInv.ending_balance ?? 0) - (anyInv.starting_balance ?? 0);
  if (consumed <= 0 || !invoice.id) return;

  await recordWalletTransaction({
    userId,
    amountCents: -consumed,
    type: "payment_applied",
    description: "Credit applied to payment",
    stripeInvoiceId: invoice.id,
  });
}
