"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import AdditionalPaymentBanner from "@/components/AdditionalPaymentBanner";
import type { PortalOfferDto } from "@/lib/offers/types";

import CurrentMedicationCard, { ActiveMedicationsEmptyState } from "./CurrentMedicationCard";
import DeliverySupportBanner from "./DeliverySupportBanner";
import MedicationRequestsSection from "./MedicationRequestsSection";
import MyMedsHeader from "./MyMedsHeader";
import MyMedsReferralCard from "./MyMedsReferralCard";
import PastTreatmentsSection from "./PastTreatmentsSection";
import type { MyMedsPageDataDto } from "./types";

type MyMedsPageClientProps = {
  data: MyMedsPageDataDto;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  referralCode: string;
  referralLink: string;
  rewardCents: number;
  offer?: PortalOfferDto | null;
  paymentJustCompleted?: boolean;
};

export default function MyMedsPageClient({
  data,
  fullName,
  patientId,
  avatarUrl,
  referralCode,
  referralLink,
  rewardCents,
  offer = null,
  paymentJustCompleted = false,
}: MyMedsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(data.requests.query);
  const stillDue = data.pendingPayments.length > 0;

  useEffect(() => {
    if (!paymentJustCompleted || !stillDue) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= 5) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [paymentJustCompleted, stillDue, router]);

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
      router.push(query ? `/my-meds?${query}` : "/my-meds");
    });
  }

  return (
    <div className="space-y-4 px-4">
      <MyMedsHeader fullName={fullName} patientId={patientId} avatarUrl={avatarUrl} offer={offer} />

      {paymentJustCompleted && !stillDue ? (
        <p className="rounded-[16px] border border-[#C8E6D0] bg-[#E0FAE8] px-4 py-3 text-sm text-[#34845F]">
          Payment received. Your care team can now continue your prescription.
        </p>
      ) : null}

      <AdditionalPaymentBanner payments={data.pendingPayments} />

      <MyMedsReferralCard
        referralCode={referralCode}
        referralLink={referralLink}
        rewardCents={rewardCents}
      />

      {data.activeMedications.length === 0 ? (
        <ActiveMedicationsEmptyState />
      ) : (
        <section className="space-y-3">
          <h2 className="px-1 text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
            Active Treatments
            {data.activeMedications.length > 1 ? (
              <span className="ml-2 text-sm font-normal text-[#152A51]/60">
                ({data.activeMedications.length})
              </span>
            ) : null}
          </h2>
          {data.activeMedications.map((medication) => (
            <CurrentMedicationCard
              key={medication.subscriptionId}
              medication={medication}
              hideTitle
            />
          ))}
        </section>
      )}

      <PastTreatmentsSection medications={data.pastMedications} />
      <DeliverySupportBanner />
      <MedicationRequestsSection
        requests={data.requests}
        isPending={isPending}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onChangePage={(page) => updateParams({ page })}
        onSearchSubmit={() => updateParams({ q: searchQuery })}
      />
    </div>
  );
}
