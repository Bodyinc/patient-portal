"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ConsultationsPageData } from "@/lib/consultations/types";
import { getDbMedicineImageSrc } from "@/lib/intake/medicine-image";
import { cn } from "@/lib/utils";

import MedicineProductImage from "../../../onboarding/_components/MedicineProductImage";
import DashboardHeader from "../../_components/DashboardHeader";

type ConsultationsPageClientProps = {
  data: ConsultationsPageData;
};

export default function ConsultationsPageClient({ data }: ConsultationsPageClientProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function openPlan(subscriptionId: string) {
    setPendingId(subscriptionId);
    router.push(`/consultations/open/${subscriptionId}`);
  }

  return (
    <main className="mx-auto w-full max-w-full flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-2">
      <DashboardHeader
        fullName={data.fullName}
        patientId={data.patientId}
        avatarUrl={data.avatarUrl}
      />

      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[32px]">
            Consultations
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#152A51]/80 sm:text-base">
            Talk with your provider by video or chat. A checkout includes one consultation when a
            medicine in the order requires it, and that visit covers every treatment in the order.
          </p>
        </div>

        {!data.configured ? (
          <p className="rounded-[16px] border border-[#E8EEED] bg-white px-4 py-3 text-sm text-[#152A51]">
            Consultations are not available yet. Please check back soon.
          </p>
        ) : data.plans.length > 0 ? (
          <ul className="space-y-3">
            {data.plans.map((plan) => {
              const finished = plan.visitStatus === "closed" || Boolean(plan.endedAt);
              const busy = pendingId === plan.subscriptionId;
              const imageSrc = getDbMedicineImageSrc(plan.imageSrc);
              const fields = [
                { label: "Medication Name", value: plan.medicineName },
                { label: "Current Plan", value: plan.planLabel ?? "Active plan" },
                {
                  label: "Consultation",
                  value: !plan.startedAt
                    ? "1 included"
                    : plan.hasFormSubmission
                      ? "Intake form complete"
                      : "Intake form pending",
                },
              ];

              return (
                <li
                  key={plan.subscriptionId}
                  className="overflow-hidden rounded-[10px] border border-[#E8EEED] bg-white"
                >
                  <div className="flex min-h-[102px] flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-0 sm:pr-5">
                    <div className="relative mx-auto h-[102px] w-[102px] shrink-0 overflow-hidden rounded-[10px] bg-[#E8EEED] sm:mx-0">
                      <MedicineProductImage
                        src={imageSrc}
                        alt={plan.medicineName}
                        fillParent
                        frameClassName="rounded-[10px] bg-[#E8EEED]"
                      />
                    </div>

                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0 sm:py-3">
                      {fields.map((field, index) => (
                        <div
                          key={field.label}
                          className={cn(
                            "min-w-0 sm:px-4",
                            index > 0 && "sm:border-l sm:border-[#E8EEED]",
                            index === 0 && "sm:pl-0",
                          )}
                        >
                          <p className="text-xs text-[#152A51]/60 sm:text-[13px]">{field.label}</p>
                          <p className="mt-1 truncate text-sm font-medium text-[#152A51] sm:text-[15px]">
                            {field.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex shrink-0 items-center sm:py-3">
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => openPlan(plan.subscriptionId)}
                        className="h-[46px] w-full rounded-full bg-[#152A51] px-6 text-sm font-medium whitespace-nowrap text-white hover:bg-[#152A51]/90 sm:w-fit"
                      >
                        {busy
                          ? "Opening…"
                          : finished
                            ? "Support"
                            : !plan.startedAt
                              ? "Start consultation"
                              : plan.hasFormSubmission
                                ? "Open consultation"
                                : "Complete intake form"}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[16px] border border-[#E8EEED] bg-white px-4 py-3 text-sm text-[#152A51]">
            {data.onboardingComplete
              ? "Consultations show up here when a medicine you ordered is set to require one."
              : "Finish onboarding first. If a medicine in your order requires a consultation, you can start it from this page."}
          </p>
        )}
      </section>
    </main>
  );
}
