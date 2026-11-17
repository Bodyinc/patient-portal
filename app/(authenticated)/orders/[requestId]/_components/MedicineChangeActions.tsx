"use client";

import { useState } from "react";
import Link from "next/link";

import { respondToMedicineChange } from "@/lib/actions/medicine-change";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function MedicineChangeActions({
  requestId,
  mode,
  amountCents,
  emphasized,
}: {
  requestId: string;
  mode: "payment" | "consent";
  amountCents: number;
  emphasized: "pay" | "decline" | "approve" | "reject" | null;
}) {
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approve" | "decline" | null>(null);

  async function choose(decision: "approve" | "decline") {
    setPending(decision);
    setError(null);
    try {
      const result = await respondToMedicineChange(requestId, decision);
      if (!result.ok) {
        setError(result.message);
        setPending(null);
        return;
      }
      setDone(decision);
    } catch {
      setError("This choice could not be saved. Please try again.");
      setPending(null);
    }
  }

  if (done === "approve") {
    return (
      <p className="rounded-xl border border-[#E8EEED] bg-[#E0FAE8] p-4 text-sm text-[#152A51]">
        You approved this change. The updated order is being sent to the pharmacy.
      </p>
    );
  }

  if (done === "decline") {
    return (
      <p className="rounded-xl border border-[#E8EEED] bg-[#F3F6F6] p-4 text-sm text-[#152A51]">
        {mode === "payment"
          ? "You declined this change. You were not charged, the pending charge was cancelled, and the order is back under review with the previous medicine and plan."
          : "You rejected this change. Nothing was charged, no credit was applied, and the order is back under review with the previous medicine and plan."}
      </p>
    );
  }

  const primaryClass =
    "inline-flex h-11 items-center justify-center rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90 disabled:opacity-60";
  const secondaryClass =
    "inline-flex h-11 items-center justify-center rounded-full border border-[#152A51] bg-white px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] disabled:opacity-60";

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        {mode === "payment" ? (
          <Link
            href={`/orders/${requestId}/pay`}
            className={emphasized === "decline" ? secondaryClass : primaryClass}
          >
            Pay {money(amountCents)}
          </Link>
        ) : (
          <button
            type="button"
            disabled={pending != null}
            onClick={() => void choose("approve")}
            className={emphasized === "reject" ? secondaryClass : primaryClass}
          >
            {pending === "approve" ? "Approving…" : "Approve this change"}
          </button>
        )}
        <button
          type="button"
          disabled={pending != null}
          onClick={() => void choose("decline")}
          className={
            emphasized === "decline" || emphasized === "reject" ? primaryClass : secondaryClass
          }
        >
          {pending === "decline"
            ? mode === "payment"
              ? "Declining…"
              : "Rejecting…"
            : mode === "payment"
              ? "Decline this change"
              : "Reject this change"}
        </button>
      </div>
    </div>
  );
}
