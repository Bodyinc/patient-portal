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
      className={`flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white p-1.5 shadow-none transition-all ${
        selected
          ? "border-[#2E00AB] ring-2 ring-[#2E00AB]/20"
          : "border-[#2E00AB]/20 hover:border-[#2E00AB]/50"
      }`}
    >
      <div className="relative flex min-h-[88px] flex-[2] items-center justify-center overflow-hidden rounded-xl bg-[#F3EEFF] sm:min-h-[100px] lg:min-h-[110px]">
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
          className="relative z-10 h-auto max-h-[70%] w-auto object-contain"
        />

        <div
          className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            selected ? "border-[#2E00AB] bg-[#2E00AB]" : "border-[#2E00AB]/25 bg-white"
          }`}
        >
          {selected && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
        </div>
      </div>

      <div className="flex flex-[3] flex-col gap-1.5 p-3 sm:gap-2 sm:p-3">
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

        <div className="mt-auto space-y-2 pt-1">
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
