"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import BillingHeader from "./BillingHeader";
import BillingSupportNote from "./BillingSupportNote";
import CancelSubscriptionModal from "./CancelSubscriptionModal";
// import BillingReferralCard from "./BillingReferralCard";
import PaymentHistorySection from "./PaymentHistorySection";
import PaymentMethodSection from "./PaymentMethodSection";
import SubscriptionsSection from "./SubscriptionsSection";
import WalletCard from "./WalletCard";
import type { BillingPageDataDto, BillingSubscriptionDto } from "./types";
import type { ReferralSummary } from "@/lib/referrals";
import type { WalletSummary } from "@/lib/wallet";

type BillingPageClientProps = {
  data: BillingPageDataDto;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  referral: ReferralSummary | null;
  wallet: WalletSummary | null;
};

export default function BillingPageClient({
  data,
  fullName,
  patientId,
  avatarUrl,
  referral,
  wallet,
}: BillingPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(data.payments.query);
  const [cancelling, setCancelling] = useState<BillingSubscriptionDto | null>(null);
  const cancelled = searchParams.get("cancelled") === "1";
  const cancelSubscriptionId = searchParams.get("cancel");

  useEffect(() => {
    if (!cancelSubscriptionId) return;
    const match = data.subscriptions.find((sub) => sub.id === cancelSubscriptionId);
    if (match && !match.cancelAtPeriodEnd) {
      setCancelling(match);
    }
    router.replace("/billing", { scroll: false });
  }, [cancelSubscriptionId, data.subscriptions, router]);

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

      {cancelled ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your subscription will cancel at the end of the current billing period. Access to the
          already-paid period continues until then; future renewals will not be charged.
        </div>
      ) : null}

      {wallet ? <WalletCard wallet={wallet} /> : null}
      <SubscriptionsSection subscriptions={data.subscriptions} onCancel={setCancelling} />
      <PaymentMethodSection />
      <PaymentHistorySection
        payments={data.payments}
        isPending={isPending}
        onChangePage={(page) => updateParams({ page })}
      />
      <BillingSupportNote />

      {cancelling ? (
        <CancelSubscriptionModal
          open
          subscriptionId={cancelling.id}
          medicineName={cancelling.medicineName}
          nextBillingDate={cancelling.nextBillingDate}
          onOpenChange={(open) => {
            if (!open) setCancelling(null);
          }}
        />
      ) : null}
    </div>
  );
}
