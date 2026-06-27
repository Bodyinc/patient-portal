"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";

type MedicationCardProps = {
  selected?: boolean;
};

export default function MedicationCard({ selected = false }: MedicationCardProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-[20px] border border-[#2E00AB]/20 bg-white p-2 shadow-none">
      <div className="relative flex min-h-[140px] flex-[2] items-center justify-center overflow-hidden rounded-[16px] bg-[#F3EEFF] sm:min-h-[200px]">
        <Image
          src="/curve-line.svg"
          alt=""
          width={400}
          height={220}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70 select-none"
        />

        <Image
          src="/syrup.svg"
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

      <div className="flex flex-[3] flex-col gap-3 p-4 sm:gap-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-medium text-[#2E00AB] sm:text-2xl">Wegovy®</h2>
          <span className="shrink-0 rounded-md border border-[#2E00AB]/15 bg-[#F8F4FF] px-3 py-1 text-sm font-medium text-[#2E00AB]">
            GLP-1
          </span>
        </div>

        <p className="line-clamp-3 text-sm leading-relaxed text-[#2E00AB]/80 sm:text-base">
          Personalized GLP-1 treatment designed to support appetite control, sustainable weight
          loss, and long-term wellness goals.
        </p>

        <div className="mt-auto space-y-3 sm:space-y-4">
          <h3 className="text-2xl font-semibold leading-none text-[#2E00AB] sm:text-3xl lg:text-[36px]">
            $199/mo
          </h3>

          <button
            type="button"
            className={`w-full rounded-md border py-3 text-sm font-medium transition-all sm:py-3.5 sm:text-base ${
              selected
                ? "border-[#2E00AB] bg-[#2E00AB] text-white"
                : "border-[#2E00AB]/30 bg-white text-[#2E00AB] hover:bg-[#F8F4FF]"
            }`}
          >
            View Details
          </button>
        </div>
      </div>
    </Card>
  );
}
