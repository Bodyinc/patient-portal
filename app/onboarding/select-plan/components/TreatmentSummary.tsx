"use client";

import Link from "next/link";
import { Check, RefreshCw } from "lucide-react";

import MedicineImage from "../../_components/MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { DEFAULT_MEDICINE_IMAGE } from "@/lib/intake/medicine-image";
import { cn } from "@/lib/utils";
import { medicineImageFrameClass, medicineImageFitClass } from "../../_lib/onboarding-theme";

type TreatmentSummaryProps = {
  medicine: MedicineDto | null;
  goalName: string | null;
  requiresQuestionnaire?: boolean;
};

export default function TreatmentSummary({
  medicine,
  goalName,
  requiresQuestionnaire = false,
}: TreatmentSummaryProps) {
  if (!medicine) return null;

  const imageFromDb =
    medicine.imageSrc && medicine.imageSrc !== DEFAULT_MEDICINE_IMAGE ? medicine.imageSrc : null;

  const pills = [
    medicine.tag?.trim() || null,
    requiresQuestionnaire ? "Licensed Provider Consultation" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="w-full onboarding-font">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="truncate text-[14px] font-medium text-[#152A51]">
          {goalName ?? medicine.tag ?? "Selected treatment"}
        </p>
        <Link
          href="/onboarding/medications"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E8E8E8] px-3 py-1.5 text-[12px] font-medium text-[#152A51] transition hover:bg-[#F7F8FA]"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Change treatment
        </Link>
      </div>

      <div className="rounded-[14px] border border-[#E8E8E8] bg-white p-3 shadow-[0_2px_12px_rgba(21,42,81,0.06)] sm:p-4">
        <div className="flex gap-3 sm:gap-4">
          <div
            className={cn("h-[72px] w-[72px] shrink-0 sm:h-20 sm:w-20", medicineImageFrameClass)}
          >
            {imageFromDb ? (
              <MedicineImage
                src={imageFromDb}
                alt={medicine.name}
                fill
                width={80}
                height={80}
                dbOnly
                className={medicineImageFitClass}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-medium leading-snug text-[#152A51] sm:text-[16px]">
              {medicine.name}
            </h3>
            {medicine.description ? (
              <p className="mt-1 line-clamp-2 text-[13px] font-normal leading-snug text-[#152A51]/70">
                {medicine.description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {pills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {pills.map((pill) => (
            <span
              key={pill}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#DCE8E8] bg-[#F3F8F8] px-3 py-1.5 text-[12px] font-medium text-[#152A51]"
            >
              <Check className="h-3 w-3 text-[#6A9B9C]" aria-hidden />
              {pill}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
