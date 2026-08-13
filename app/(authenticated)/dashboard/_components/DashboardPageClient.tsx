"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPortalDate } from "@/lib/date-format";
import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import type { DashboardPageDataDto } from "@/lib/dashboard/types";
import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";
import { cn } from "@/lib/utils";

import MedicineProductImage from "../../../onboarding/_components/MedicineProductImage";
import DashboardHeader from "../../_components/DashboardHeader";

/** Figma treatment row — hug height ~102px; bottle well fills card vertically */
const TREATMENT_ROW_HEIGHT = 102;

type DashboardPageClientProps = {
  data: DashboardPageDataDto;
};

function formatDate(value: string | null): string {
  return formatPortalDate(value);
}

function HealthGoalHeroCard({ name, imageSrc }: { name: string; imageSrc: string | null }) {
  const external = imageSrc ? isExternalMedicineImage(imageSrc) : false;

  return (
    <div className="relative min-h-[200px] w-full overflow-hidden rounded-[24px] border border-[#E8EEED] bg-[#E8EEED] sm:min-h-[240px] lg:h-[304px] lg:min-h-0">
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 40vw"
          unoptimized={external}
          className="object-cover object-center"
        />
      ) : null}
      <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-[14px] border border-white/10 bg-[#0A172D]/14 px-6 py-4 backdrop-blur-[2px]">
        <p className="text-xs font-normal leading-none text-white/90 sm:text-[13px]">
          Your health goals
        </p>
        <p className="mt-3.5 text-lg font-medium leading-snug tracking-[-0.25px] text-white sm:text-[22px]">
          {name}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPageClient({ data }: DashboardPageClientProps) {
  const router = useRouter();
  const canRefill = Boolean(data.treatment?.medicineId);

  const treatmentFields = data.treatment
    ? [
        { label: "Medication Name", value: data.treatment.name },
        { label: "Dose", value: data.treatment.variantDose },
        { label: "Current Plan", value: data.treatment.currentPlan },
        { label: "Next Refill Date", value: formatDate(data.treatment.nextRefillDate) },
      ]
    : [];

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
    <main className="mx-auto w-full max-w-[1680px] flex-1 px-2 py-4 sm:px-4 lg:px-6 xl:px-8">
      <DashboardHeader
        fullName={data.fullName}
        patientId={data.patientId}
        avatarUrl={data.avatarUrl}
      />

      {/* Figma top row: Ready to begin 1042×304 + health goal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.88fr)_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[minmax(0,1042px)_minmax(0,553px)]">
        <section className="flex flex-col rounded-[24px] border border-[#E8EEED] bg-white p-6 lg:h-[304px]">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#152A51]/60 sm:text-sm">
            <span>Next step</span>
          </div>
          <h3 className="text-lg font-medium leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
            Ready to begin your treatment journey?
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#152A51]/80 sm:text-[15px] sm:leading-7">
            Your clinician review is scheduled once your intake is complete. Please answer all
            questions to the best of your ability.
          </p>
          <div className="mt-auto pt-5">
            <Button className="h-[46px] w-full rounded-full bg-[#E3E084] px-6 text-sm font-medium text-[#152A51] hover:bg-[#D9D674] sm:w-fit">
              Complete intake form
            </Button>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col">
          {data.goals.length > 0 ? (
            <ul className="flex min-h-0 flex-1 flex-col gap-4">
              {data.goals.map((goal) => (
                <li key={goal.id} className="min-h-0 flex-1">
                  <HealthGoalHeroCard name={goal.name} imageSrc={goal.imageSrc?.trim() || null} />
                </li>
              ))}
            </ul>
          ) : (
            <section className="flex min-h-[200px] items-center justify-center rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:min-h-[240px] lg:h-[304px] lg:min-h-0">
              <p className="text-sm text-[#152A51]/60">No health goals on file yet.</p>
            </section>
          )}
        </aside>
      </div>

      {data.treatment ? (
        /* Figma treatment row: radius 10, pr 20, gap 32, bottle flush to card height */
        <section className="mt-4 overflow-hidden rounded-[10px] border border-[#E8EEED] bg-white">
          <div
            className="flex flex-col sm:flex-row sm:items-stretch sm:gap-8 sm:pr-5"
            style={{ minHeight: TREATMENT_ROW_HEIGHT }}
          >
            <div className="relative mx-auto h-[102px] w-[102px] shrink-0 overflow-hidden rounded-[10px] bg-[#E8EEED] sm:mx-0 sm:h-auto sm:w-[102px] sm:self-stretch">
              <MedicineProductImage
                src={data.treatment.imageSrc}
                alt={data.treatment.name}
                fillParent
                frameClassName="rounded-[10px] bg-[#E8EEED]"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-0 sm:py-3">
              {/* Fields hug content; spacer creates Figma gap before refill CTA */}
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:items-center lg:gap-0">
                {treatmentFields.map((field, index) => (
                  <div
                    key={field.label}
                    className={cn(
                      "min-w-0 lg:max-w-[200px] lg:px-4",
                      index > 0 && "lg:border-l lg:border-[#E8EEED]",
                      index === 0 && "lg:pl-0",
                    )}
                  >
                    <p className="text-xs text-[#152A51]/60 sm:text-[13px]">{field.label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-[#152A51] sm:text-[15px]">
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden min-w-[64px] flex-1 lg:block" aria-hidden />

              <div className="flex shrink-0 items-center sm:ml-auto lg:ml-0">
                <button
                  type="button"
                  onClick={handleRefillRequest}
                  disabled={!canRefill}
                  className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-full border border-[#152A51]/20 bg-white px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
                >
                  New Refill Request
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {data.activeTreatmentCount > 1 ? (
            <p className="border-t border-[#E8EEED] px-4 py-3 text-sm text-[#152A51]/70 sm:px-5">
              You have {data.activeTreatmentCount} active treatments.{" "}
              <Link
                href="/my-meds"
                className="font-medium text-[#152A51] underline underline-offset-2 hover:text-[#152A51]/80"
              >
                View all on My Meds
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
