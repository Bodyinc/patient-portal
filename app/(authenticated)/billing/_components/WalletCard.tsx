"use client";

import { Wallet } from "lucide-react";
import { useState } from "react";

import type { WalletSummary } from "@/lib/wallet";

type WalletCardProps = {
  wallet: WalletSummary;
};

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WalletCard({ wallet }: WalletCardProps) {
  const [expanded, setExpanded] = useState(false);
  const transactions = expanded ? wallet.transactions : wallet.transactions.slice(0, 3);

  return (
    <section className="rounded-md border border-[#E8EEED] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-2xl font-semibold text-[#152A51]">
            <Wallet className="h-6 w-6" />
            Wallet
          </p>
          <p className="mt-1 text-sm text-[#152A51]/80">
            Credits from referrals apply automatically to your next bill.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wide text-[#152A51]/60">Available balance</p>
          <p className="text-3xl font-semibold text-[#152A51]">{formatUsd(wallet.balanceCents)}</p>
        </div>
      </div>

      {wallet.transactions.length > 0 ? (
        <div className="mt-4 border-t border-[#E8EEED] pt-3">
          <ul className="space-y-2 text-sm">
            {transactions.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[#152A51]/80">
                  {txn.description ??
                    (txn.type === "referral_reward"
                      ? "Referral reward"
                      : txn.type === "payment_applied"
                        ? "Credit applied to payment"
                        : "Adjustment")}
                  <span className="ml-2 text-xs text-[#152A51]/50">
                    {formatDate(txn.created_at)}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-semibold ${
                    txn.amount_cents >= 0 ? "text-emerald-700" : "text-[#152A51]"
                  }`}
                >
                  {txn.amount_cents >= 0 ? "+" : "−"}
                  {formatUsd(Math.abs(txn.amount_cents))}
                </span>
              </li>
            ))}
          </ul>
          {wallet.transactions.length > 3 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-medium text-[#152A51] underline"
            >
              {expanded ? "Show less" : `Show all ${wallet.transactions.length}`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 border-t border-[#E8EEED] pt-3 text-sm text-[#152A51]/60">
          No wallet activity yet — invite a friend to earn your first credit.
        </p>
      )}
    </section>
  );
}
