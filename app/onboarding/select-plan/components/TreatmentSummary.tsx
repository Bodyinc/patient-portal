"use client";

import Link from "next/link";
import { Check, RefreshCw } from "lucide-react";

import MedicineImage from "../../_components/MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { DEFAULT_MEDICINE_IMAGE } from "@/lib/intake/medicine-image";
import { cn } from "@/lib/utils";

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
          {/* Figma Specs: Width ~147px, Height 154px, Radius 17px */}
          <div
            className="
              relative isolate
              h-[154px] w-full
              shrink-0
              overflow-hidden
              bg-[#5A778D]
              rounded-[17px]
              sm:w-[147px]
              sm:rounded-[17px]
            "
          >
            {imageFromDb ? (
              <MedicineImage
                src={imageFromDb}
                alt={medicine.name}
                fill
                dbOnly
                fit="contain"
                position="center"
              />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-5">
            <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[18px]">
              {medicine.name}
            </h3>
            {medicine.description ? (
              <p className="mt-1.5 text-[13px] font-normal leading-relaxed text-[#152A51]/70 sm:line-clamp-3 sm:text-[14px]">
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
