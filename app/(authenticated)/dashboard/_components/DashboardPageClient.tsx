"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import type { DashboardPageDataDto } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

import {
  medicineImageFrameClass,
  medicineImageFitClass,
} from "../../../onboarding/_lib/onboarding-theme";

import BmiGauge from "../../../onboarding/_components/BmiGauge";

import DashboardHeader from "../../_components/DashboardHeader";

/** Figma treatment image: 339 × 354.6 */
const TREATMENT_IMAGE_ASPECT = "339 / 354.6";

type DashboardPageClientProps = {
  data: DashboardPageDataDto;
};

export default function DashboardPageClient({ data }: DashboardPageClientProps) {
  const firstName = data.fullName.trim().split(/\s+/)[0] || "there";
  const treatmentImage = data.treatment?.imageSrc ?? null;
  const treatmentExternal = treatmentImage ? isExternalMedicineImage(treatmentImage) : false;

  return (
    <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4">
      <DashboardHeader
        fullName={data.fullName}
        patientId={data.patientId}
        avatarUrl={data.avatarUrl}
      />

      <div className="mb-4 flex flex-col gap-3 rounded-[16px] bg-[#E8EEED] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
        <p className="text-sm font-medium leading-snug text-[#152A51] sm:text-[15px]">
          Your clinician review is now available — Book your session
        </p>
        <Button className="h-[46px] w-full shrink-0 rounded-full bg-[#6A9B9C] px-5 text-sm font-medium text-white shadow-none hover:bg-[#6A9B9C]/90 sm:w-auto sm:text-[16px]">
          Book now
        </Button>
      </div>

      <h2 className="mb-4 text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[28px]">
        Keep it up, {firstName}!
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#152A51]/60 sm:text-sm">
              <span>Next step</span>
              <span>Step 2 of 4</span>
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
              <p className="text-xs text-[#152A51]/60 sm:text-right sm:text-sm">
                Estimated time: 8-10 min
              </p>
            </div>
          </section>

          {data.treatment ? (
            <section className="overflow-hidden rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
                <div
                  className={cn(
                    "mx-auto w-full max-w-[339px] shrink-0 sm:mx-0 sm:w-full sm:max-w-[280px] lg:max-w-[339px]",
                    medicineImageFrameClass,
                  )}
                  style={{ aspectRatio: TREATMENT_IMAGE_ASPECT }}
                >
                  {treatmentImage ? (
                    <Image
                      src={treatmentImage}
                      alt={data.treatment.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 339px"
                      unoptimized={treatmentExternal}
                      className={medicineImageFitClass}
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <h3 className="text-lg font-medium leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
                    {data.treatment.name}
                  </h3>
                  {data.treatment.description ? (
                    <p className="mt-3 text-sm leading-relaxed text-[#152A51]/80 sm:text-[15px] sm:leading-7">
                      {data.treatment.description}
                    </p>
                  ) : null}
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
                  const iconExternal = goal.icon ? isExternalMedicineImage(goal.icon) : false;
                  return (
                    <li
                      key={goal.id}
                      className="flex items-center gap-3 rounded-[14px] bg-[#F3F6F6] px-3 py-2.5"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-[#E8EEED]">
                        {goal.icon ? (
                          <Image
                            src={goal.icon}
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
                      <p className="min-w-0 text-sm font-medium text-[#152A51] sm:text-[15px]">
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

          <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
            {data.bmi !== null ? (
              <BmiGauge bmi={data.bmi} category={data.bmiCategory} />
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-[#152A51]">BMI</p>
                <p className="mt-2 text-sm text-[#152A51]/60">
                  Complete body measurements to see your BMI.
                </p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
