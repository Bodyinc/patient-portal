"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import BillingHeader from "./BillingHeader";
import BillingReferralCard from "./BillingReferralCard";
import PaymentHistorySection from "./PaymentHistorySection";
import SubscriptionsSection from "./SubscriptionsSection";
import type { BillingPageDataDto } from "./types";

type BillingPageClientProps = {
  data: BillingPageDataDto;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  referralCode: string;
};

export default function BillingPageClient({
  data,
  fullName,
  patientId,
  avatarUrl,
  referralCode,
}: BillingPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(data.payments.query);
  const cancelled = searchParams.get("cancelled") === "1";

  function updateParams(next: { page?: number; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.q !== undefined) {
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
      params.set("page", "1");
    }

    if (next.page !== undefined) {
      if (next.page <= 1) params.delete("page");
      else params.set("page", String(next.page));
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/billing?${query}` : "/billing");
    });
  }

  return (
    <div className="space-y-3">
      <BillingHeader
        fullName={fullName}
        patientId={patientId}
        avatarUrl={avatarUrl}
        searchQuery={searchQuery}
        searchPending={isPending}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => updateParams({ q: searchQuery })}
      />

      <section className="space-y-1 px-1 pt-1">
        <h1 className="text-2xl font-semibold text-[#2E00AB]">Billing</h1>
        <p className="text-sm text-[#2E00AB]/70">
          Manage your payment methods, billing history, invoices, and subscriptions.
        </p>
      </section>

      {cancelled ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your subscription will cancel at the end of the current billing period.
        </div>
      ) : null}

      <BillingReferralCard referralCode={referralCode} />
      <SubscriptionsSection subscriptions={data.subscriptions} />
      <PaymentHistorySection
        payments={data.payments}
        isPending={isPending}
        onChangePage={(page) => updateParams({ page })}
      />
    </div>
  );
}
