"use client";

import Image from "next/image";

import type { Medication } from "../_lib/onboarding-config";

type MedicationCardProps = {
  medication: Medication;
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
      className={`flex h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border bg-white p-2 shadow-none transition-all ${
        selected
          ? "border-[#2E00AB] ring-2 ring-[#2E00AB]/20"
          : "border-[#2E00AB]/20 hover:border-[#2E00AB]/50"
      }`}
    >
      <div className="relative flex min-h-[140px] flex-[2] items-center justify-center overflow-hidden rounded-[16px] bg-[#F3EEFF] sm:min-h-[180px]">
        <Image
          src="/curve-line.svg"
          alt=""
          width={400}
          height={220}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70 select-none"
        />

        <Image
          src={medication.imageSrc ?? "/syrup.svg"}
          alt="Medication"
          width={200}
          height={200}
          className="relative z-10 h-auto max-h-[75%] w-auto object-contain"
        />

        <div
          className={`absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border-2 ${
            selected ? "border-[#2E00AB] bg-[#2E00AB]" : "border-[#2E00AB]/25 bg-white"
          }`}
        >
          {selected && <div className="h-3 w-3 rounded-full bg-white" />}
        </div>
      </div>

      <div className="flex flex-[3] flex-col gap-2 p-4 sm:gap-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-medium text-[#2E00AB] sm:text-xl">{medication.name}</h2>
          <span className="shrink-0 rounded-md border border-[#2E00AB]/15 bg-[#F8F4FF] px-2.5 py-1 text-xs font-medium text-[#2E00AB] sm:text-sm">
            {medication.tag}
          </span>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-[#2E00AB]/80">
          {medication.description}
        </p>

        <div className="mt-auto space-y-3 pt-2">
          <h3 className="text-xl font-semibold leading-none text-[#2E00AB] sm:text-2xl">
            ${medication.priceMonthly}/mo
          </h3>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(medication.id);
            }}
            className="w-full rounded-md border border-[#2E00AB]/30 bg-white py-2.5 text-sm font-medium text-[#2E00AB] transition-all hover:bg-[#F8F4FF] sm:py-3 sm:text-base"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
