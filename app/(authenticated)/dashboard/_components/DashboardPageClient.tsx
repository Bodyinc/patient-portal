"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import type { DashboardPageDataDto } from "@/lib/dashboard/types";
import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";
import { cn } from "@/lib/utils";

import {
  medicineImageFitClass,
  medicineImageFrameClass,
} from "../../../onboarding/_lib/onboarding-theme";

import DashboardHeader from "../../_components/DashboardHeader";

/** Figma treatment image aspect ratio — keep dashboard image sizing */
const TREATMENT_IMAGE_ASPECT = "339 / 354.6";

type DashboardPageClientProps = {
  data: DashboardPageDataDto;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function DashboardPageClient({ data }: DashboardPageClientProps) {
  const router = useRouter();
  const treatmentImage = data.treatment?.imageSrc ?? null;
  const treatmentExternal = treatmentImage ? isExternalMedicineImage(treatmentImage) : false;
  const canRefill = Boolean(data.treatment?.medicineId);

  function handleRefillRequest() {
    if (!data.treatment?.medicineId) return;
    router.push(
      buildShopCheckoutHref({
        medicineId: data.treatment.medicineId,
        variantId: data.treatment.variantId,
        packageId: data.treatment.packageId,
        from: "dashboard",
      }),
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-2 py-4 sm:px-4 lg:px-6 xl:px-6">
      <DashboardHeader
        fullName={data.fullName}
        patientId={data.patientId}
        avatarUrl={data.avatarUrl}
      />

      {/* <div className="mb-4 flex flex-col gap-3 rounded-[16px] bg-[#E8EEED] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
        <p className="text-sm font-medium leading-snug text-[#152A51] sm:text-[15px]">
          Your clinician review is now available — Book your session
        </p>
        <Button className="h-[46px] w-full shrink-0 rounded-full bg-[#6A9B9C] px-5 text-sm font-medium text-white shadow-none hover:bg-[#6A9B9C]/90 sm:w-auto sm:text-[16px]">
          Book now
        </Button>
      </div> */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
            <div className="mb-3 flex font-semibold items-center justify-between gap-3 text-xs text-[#152A51]/60 sm:text-sm">
              <span>Next step</span>
            </div>
            <h3 className="text-lg font-medium leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
              Ready to begin your treatment journey?
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#152A51]/80 sm:text-[15px] sm:leading-7">
              Your clinician review is scheduled once your intake is complete. Please answer all
              questions to the best of your ability.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <Button className="h-[46px] w-full rounded-full bg-[#E3E084] px-6 text-sm font-medium text-[#152A51] hover:bg-[#D9D674] sm:w-fit">
                Complete intake form
              </Button>
            </div>
          </section>

          {data.treatment ? (
            <section className="rounded-[24px] border border-[#E8EEED] bg-white ">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
                <div
                  className={cn(
                    "mx-auto w-full max-w-[220px] shrink-0 sm:mx-0 sm:max-w-[180px] lg:max-w-[220px]",
                    medicineImageFrameClass,
                  )}
                  style={{ aspectRatio: TREATMENT_IMAGE_ASPECT }}
                >
                  {treatmentImage ? (
                    <Image
                      src={treatmentImage}
                      alt={data.treatment.name}
                      fill
                      sizes="220px"
                      unoptimized={treatmentExternal}
                      className={medicineImageFitClass}
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between p-5 gap-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[#152A51]/60 sm:text-sm">Medication Name</p>
                      <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                        {data.treatment.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#152A51]/60 sm:text-sm">Current Plan</p>
                      <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                        {data.treatment.currentPlan}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#152A51]/60 sm:text-sm">Dose</p>
                      <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                        {data.treatment.variantDose}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#152A51]/60 sm:text-sm">Next Refill Date</p>
                      <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                        {formatDate(data.treatment.nextRefillDate)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefillRequest}
                    disabled={!canRefill}
                    className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-full border border-[#152A51] px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
                  >
                    New Refill Request
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
            <h3 className="mb-3 text-base font-medium text-[#152A51] sm:text-lg">
              Your Health Goals
            </h3>
            {data.goals.length > 0 ? (
              <ul className="space-y-2.5">
                {data.goals.map((goal) => {
                  const imageSrc = goal.imageSrc?.trim() || null;
                  const iconExternal = imageSrc ? isExternalMedicineImage(imageSrc) : false;
                  return (
                    <li
                      key={goal.id}
                      className="flex items-center gap-3 rounded-[14px] bg-[#F3F6F6] px-0 py-0"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] bg-[#E8EEED]">
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt=""
                            fill
                            sizes="40px"
                            unoptimized={iconExternal}
                            className="object-cover"
                          />
                        ) : (
                          <span
                            className={cn(
                              "flex h-full w-full items-center justify-center text-sm font-medium text-[#152A51]/70",
                            )}
                            aria-hidden
                          >
                            {goal.name.slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <p className="min-w-0 text-xl ml-8 font-medium text-[#152A51] sm:text-[25px]">
                        {goal.name}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-[#152A51]/60">No health goals on file yet.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
