"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { DEFAULT_MEDICINE_IMAGE, resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { formatPortalDate } from "@/lib/date-format";
import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";

import MedicineProductImage from "../../../onboarding/_components/MedicineProductImage";

import type { MyMedsPastMedicationDto } from "./types";

/** Match active treatment row — bottle well stretches to card height. */
const TREATMENT_ROW_HEIGHT = 102;

type PastTreatmentsSectionProps = {
  medications: MyMedsPastMedicationDto[];
};

function formatDate(value: string | null): string {
  return formatPortalDate(value);
}

function toDbImageSrc(imageSrc: string | null | undefined): string | null {
  const resolved = resolveMedicineImageSrc(imageSrc);
  if (!resolved || resolved === DEFAULT_MEDICINE_IMAGE) return null;
  return resolved;
}

function PastTreatmentRow({ medication }: { medication: MyMedsPastMedicationDto }) {
  const router = useRouter();
  const imageSrc = toDbImageSrc(medication.imageSrc);
  const canOrderAgain = Boolean(medication.medicineId);

  function handleOrderAgain() {
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

  return (
    <article className="overflow-hidden rounded-[16px] border border-[#E8EEED] bg-[#F3F6F6]">
      <div
        className="flex flex-col sm:flex-row sm:items-stretch sm:gap-4 sm:pr-4"
        style={{ minHeight: TREATMENT_ROW_HEIGHT }}
      >
        <div className="relative mx-auto h-[102px] w-[102px] shrink-0 overflow-hidden rounded-[12px] bg-[#E8EEED] sm:mx-0 sm:h-auto sm:w-[102px] sm:self-stretch">
          <MedicineProductImage
            src={imageSrc}
            alt={medication.medicationName}
            fillParent
            frameClassName="rounded-[12px] bg-[#E8EEED]"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-0 sm:py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-[#152A51] sm:text-base">
                {medication.medicationName}
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#152A51]/70">
                {medication.statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#152A51]/70 sm:text-sm">
              {[medication.variantName, medication.currentPlan].filter(Boolean).join(" · ") ||
                "Previous treatment"}
            </p>
            <p className="mt-1 text-xs text-[#152A51]/60">Ended {formatDate(medication.endedAt)}</p>
          </div>

          <button
            type="button"
            onClick={handleOrderAgain}
            disabled={!canOrderAgain}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-[#152A51] bg-white px-4 text-sm font-medium text-[#152A51] hover:bg-[#E8EEED] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Order again
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function PastTreatmentsSection({ medications }: PastTreatmentsSectionProps) {
  if (medications.length === 0) return null;

  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
          Past Treatments
        </h2>
        <p className="mt-1 text-sm text-[#152A51]/70">
          Previously subscribed medications you can order again.
        </p>
      </div>
      <div className="space-y-3">
        {medications.map((medication) => (
          <PastTreatmentRow key={medication.subscriptionId} medication={medication} />
        ))}
      </div>
    </section>
  );
}
