"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  DEFAULT_MEDICINE_IMAGE,
  isExternalMedicineImage,
  resolveMedicineImageSrc,
} from "@/lib/intake/medicine-image";
import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";

import type { MyMedsPastMedicationDto } from "./types";

type PastTreatmentsSectionProps = {
  medications: MyMedsPastMedicationDto[];
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toDbImageSrc(imageSrc: string | null | undefined): string | null {
  const resolved = resolveMedicineImageSrc(imageSrc);
  if (!resolved || resolved === DEFAULT_MEDICINE_IMAGE) return null;
  return resolved;
}

function PastTreatmentRow({ medication }: { medication: MyMedsPastMedicationDto }) {
  const router = useRouter();
  const imageSrc = toDbImageSrc(medication.imageSrc);
  const external = imageSrc ? isExternalMedicineImage(imageSrc) : false;
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
    <article className="flex flex-col gap-4 rounded-[16px] border border-[#E8EEED] bg-[#F3F6F6] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border border-[#E8EEED] bg-white">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={medication.medicationName}
              fill
              sizes="64px"
              unoptimized={external}
              className="object-cover"
            />
          ) : null}
        </div>
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
