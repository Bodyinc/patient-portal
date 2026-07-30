"use client";

import Link from "next/link";
import { Check, RefreshCw } from "lucide-react";

import MedicineImage from "../../_components/MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { DEFAULT_MEDICINE_IMAGE } from "@/lib/intake/medicine-image";
import { cn } from "@/lib/utils";
import { ONBOARDING } from "../../_lib/onboarding-theme";

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

      <div className="overflow-hidden rounded-[20px] border-2 border-[#E8EEED] bg-white shadow-[0_2px_12px_rgba(21,42,81,0.06)] sm:rounded-[24px]">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          {/* Figma: slate frame, zoomed vial cropped at “Multiple dose” */}
          <div
            className={cn(
              "relative isolate h-[180px] w-full shrink-0 overflow-hidden sm:h-auto sm:min-h-[160px] sm:w-[160px] md:w-[180px]",
              "rounded-t-[18px] sm:rounded-l-[22px] sm:rounded-tr-none",
            )}
            style={{ backgroundColor: ONBOARDING.medicineImageBg }}
          >
            {imageFromDb ? (
              <MedicineImage
                src={imageFromDb}
                alt={medicine.name}
                fill
                width={180}
                height={180}
                dbOnly
                fit="cover"
                position="center 30%"
                className="scale-[1.2]"
              />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5">
            <h3 className="text-[15px] font-medium leading-snug text-[#152A51] sm:text-[16px]">
              {medicine.name}
            </h3>
            {medicine.description ? (
              <p className="mt-1.5 text-[13px] font-normal leading-snug text-[#152A51]/70 sm:line-clamp-3">
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
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D5D9E0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#152A51]"
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
