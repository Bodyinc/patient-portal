"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startConsultation } from "@/lib/consultations/actions";
import type { ConsultationsPageData } from "@/lib/consultations/types";
import { formatPortalDate } from "@/lib/date-format";
import { getDbMedicineImageSrc } from "@/lib/intake/medicine-image";
import { cn } from "@/lib/utils";

import MedicineProductImage from "../../../onboarding/_components/MedicineProductImage";
import DashboardHeader from "../../_components/DashboardHeader";

const TREATMENT_ROW_HEIGHT = 102;

type ConsultationsPageClientProps = {
  data: ConsultationsPageData;
};

export default function ConsultationsPageClient({ data }: ConsultationsPageClientProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openPlan(subscriptionId: string) {
    setPendingId(subscriptionId);
    startTransition(async () => {
      const result = await startConsultation(subscriptionId);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // QuickBlox sets X-Frame-Options: SAMEORIGIN, so it cannot load inside our portal.
      // Stay in this tab (no window.open) as requested.
      window.location.assign(result.embedUrl);
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-2">
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
            Talk with your provider by video or chat. Each active plan includes one consultation.
          </p>
        </div>

        {!data.configured ? (
          <p className="rounded-[16px] border border-[#E8EEED] bg-white px-4 py-3 text-sm text-[#152A51]">
            Consultations are not available yet. Please check back soon.
          </p>
        ) : data.plans.length > 0 ? (
          <ul className="space-y-3">
            {data.plans.map((plan) => {
              const used = Boolean(plan.startedAt);
              const busy = pending && pendingId === plan.subscriptionId;
              const imageSrc = getDbMedicineImageSrc(plan.imageSrc);
              const fields = [
                { label: "Medication Name", value: plan.medicineName },
                { label: "Current Plan", value: plan.planLabel ?? "Active plan" },
                {
                  label: "Consultation",
                  value: used ? `Started ${formatPortalDate(plan.startedAt)}` : "1 included",
                },
              ];

              return (
                <li
                  key={plan.subscriptionId}
                  className="overflow-hidden rounded-[10px] border border-[#E8EEED] bg-white"
                >
                  <div
                    className="flex flex-col sm:flex-row sm:items-stretch sm:gap-8 sm:pr-5"
                    style={{ minHeight: TREATMENT_ROW_HEIGHT }}
                  >
                    <div className="relative mx-auto h-[102px] w-[102px] shrink-0 overflow-hidden rounded-[10px] bg-[#E8EEED] sm:mx-0 sm:h-auto sm:w-[102px] sm:self-stretch">
                      <MedicineProductImage
                        src={imageSrc}
                        alt={plan.medicineName}
                        fillParent
                        frameClassName="rounded-[10px] bg-[#E8EEED]"
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-0 sm:py-3">
                      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:items-center lg:gap-0">
                        {fields.map((field, index) => (
                          <div
                            key={field.label}
                            className={cn(
                              "min-w-0 lg:max-w-[220px] lg:px-4",
                              index > 0 && "lg:border-l lg:border-[#E8EEED]",
                              index === 0 && "lg:pl-0",
                            )}
                          >
                            <p className="text-xs text-[#152A51]/60 sm:text-[13px]">
                              {field.label}
                            </p>
                            <p className="mt-1 truncate text-sm font-medium text-[#152A51] sm:text-[15px]">
                              {field.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="hidden min-w-[64px] flex-1 lg:block" aria-hidden />

                      <div className="flex shrink-0 items-center sm:ml-auto lg:ml-0">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => openPlan(plan.subscriptionId)}
                          className="h-[46px] w-full rounded-full bg-[#152A51] px-6 text-sm font-medium text-white hover:bg-[#152A51]/90 sm:w-fit"
                        >
                          {busy ? "Opening…" : used ? "Open consultation" : "Start consultation"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[16px] border border-[#E8EEED] bg-white px-4 py-3 text-sm text-[#152A51]">
            {data.onboardingComplete
              ? "You need an active or new plan to start a consultation."
              : "Finish onboarding and intake first. After that, you can start your consultation from this page."}
          </p>
        )}
      </section>
    </main>
  );
}
