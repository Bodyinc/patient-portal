"use client";

import Image from "next/image";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";

type MedicationCardProps = {
  medication: MedicineDto;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onViewDetails?: (id: string) => void;
};

export default function MedicationCard({
  medication,
  selected = false,
  onSelect,
  onViewDetails,
}: MedicationCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(medication.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(medication.id);
        }
      }}
      // FIXED: Added max-h-[480px] to prevent desktop zoom stretch, kept h-full for row alignment
      className={`flex h-full max-h-[450px] sm:max-h-[480px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white p-1.5 shadow-none transition-all ${
        selected
          ? "border-[#2E00AB] ring-2 ring-[#2E00AB]/20"
          : "border-[#2E00AB]/20 hover:border-[#2E00AB]/50"
      }`}
    >
      {/* Top visual image section */}
      <div className="relative flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3EEFF] sm:h-44">
        <Image
          src="/curve-line.svg"
          alt=""
          fill
          priority
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70 select-none"
        />

        <MedicineImage
          src={medication.imageSrc}
          alt={medication.name}
          width={200}
          height={200}
          className="relative z-10 h-auto max-h-[80%] w-auto object-contain"
        />

        <div
          className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            selected ? "border-[#2E00AB] bg-[#2E00AB]" : "border-[#2E00AB]/25 bg-white"
          }`}
        >
          {selected && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
        </div>
      </div>

      {/* Text area that expands evenly */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-medium text-[#2E00AB] sm:text-lg">{medication.name}</h2>
          <span className="shrink-0 rounded-md border border-[#2E00AB]/15 bg-[#F8F4FF] px-2 py-0.5 text-[11px] font-medium text-[#2E00AB] sm:text-xs">
            {medication.tag}
          </span>
        </div>

        {medication.requiresQuestionnaire ? (
          <span className="w-fit rounded-md bg-[#2E00AB]/10 px-2 py-0.5 text-[11px] font-medium text-[#2E00AB]">
            Screening required
          </span>
        ) : null}

        <p className="line-clamp-2 text-xs leading-snug text-[#2E00AB]/80 sm:text-sm">
          {medication.description}
        </p>

        {/* Bottom price and action area stays aligned */}
        <div className="mt-auto space-y-2 pt-3">
          <h3 className="text-lg font-semibold leading-none text-[#2E00AB] sm:text-xl">
            ${medication.priceMonthly}/mo
          </h3>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(medication.id);
            }}
            className="w-full rounded-md border border-[#2E00AB]/30 bg-white py-2 text-xs font-medium text-[#2E00AB] transition-all hover:bg-[#F8F4FF] sm:text-sm"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
