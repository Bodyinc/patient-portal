"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { DEFAULT_MEDICINE_IMAGE, resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";
import { formatPortalDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";

import MedicineProductImage from "../../../onboarding/_components/MedicineProductImage";

import type { MyMedsCurrentMedicationDto } from "./types";

/** Figma treatment row — bottle well fills card vertically */
const TREATMENT_ROW_HEIGHT = 102;

type CurrentMedicationCardProps = {
  medication: MyMedsCurrentMedicationDto;
  /** When true, omit the section heading (used inside an Active Treatments list). */
  hideTitle?: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return formatPortalDate(value);
}

function toDbImageSrc(imageSrc: string | null | undefined): string | null {
  const resolved = resolveMedicineImageSrc(imageSrc);
  if (!resolved || resolved === DEFAULT_MEDICINE_IMAGE) return null;
  return resolved;
}

export function ActiveMedicationsEmptyState() {
  return (
    <section className="rounded-[16px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
        Active Treatments
      </h2>
      <div className="rounded-[16px] border border-dashed border-[#E8EEED] bg-[#F3F6F6] px-4 py-8 text-center">
        <p className="text-sm text-[#152A51]/70">No active treatments yet.</p>
        <Link
          href="/shop"
          className="mt-4 inline-flex h-[46px] items-center rounded-full bg-[#E3E084] px-6 text-sm font-medium text-[#152A51] hover:bg-[#D9D674]"
        >
          Browse Shop
        </Link>
      </div>
    </section>
  );
}

export default function CurrentMedicationCard({
  medication,
  hideTitle = false,
}: CurrentMedicationCardProps) {
  const router = useRouter();

  function handleRefillRequest() {
    if (!medication.medicineId) return;
    router.push(
      buildShopCheckoutHref({
        medicineId: medication.medicineId,
        variantId: medication.variantId,
        packageId: medication.packageId,
        from: "my-meds",
      }),
    );
  }

  const imageSrc = toDbImageSrc(medication.imageSrc);
  const canRefill = Boolean(medication.medicineId);

  const fields = [
    { label: "Medication Name", value: medication.medicationName },
    { label: "Dose", value: medication.variantName || medication.dosage || "—" },
    { label: "Current Plan", value: medication.currentPlan },
    { label: "Next Refill Date", value: formatDate(medication.nextRefillDate) },
  ];

  return (
    <article className="overflow-hidden rounded-[10px] border border-[#E8EEED] bg-white">
      {!hideTitle ? (
        <h2 className="border-b border-[#E8EEED] px-4 py-3 text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:px-5 sm:text-[22px]">
          Active Treatment
        </h2>
      ) : null}

      {/* Figma: radius 10, pr 20, gap 32, bottle flush to card height */}
      <div
        className="flex flex-col sm:flex-row sm:items-stretch sm:gap-8 sm:pr-5"
        style={{ minHeight: TREATMENT_ROW_HEIGHT }}
      >
        <div className="relative mx-auto h-[102px] w-[102px] shrink-0 overflow-hidden rounded-[10px] bg-[#E8EEED] sm:mx-0 sm:h-auto sm:w-[102px] sm:self-stretch">
          <MedicineProductImage
            src={imageSrc}
            alt={medication.medicationName}
            fillParent
            frameClassName="rounded-[10px] bg-[#E8EEED]"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-0 sm:py-3">
          {/* Fields hug content; spacer creates Figma gap before refill CTA */}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:items-center lg:gap-0">
            {fields.map((field, index) => (
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
    </article>
  );
}
