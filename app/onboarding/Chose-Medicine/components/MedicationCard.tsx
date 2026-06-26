"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
interface Props {
  selected?: boolean;
}

export default function MedicationCard({ selected = false }: Props) {
  return (
    <Card className="w-full rounded-[20px] border border-[#2E00AB]/25 bg-white p-[8px] shadow-none">
      {/* Image Section */}
      <div className="relative h-[250px] overflow-hidden rounded-[18px] border border-[#2E00AB]/20 bg-[#F8F4FF]">
        <Image src="/background-curve.svg" alt="" fill className="object-cover opacity-70" />

        <Image
          src="/curve-line.svg"
          alt=""
          width={700}
          height={320}
          className="absolute -left-8 top-12 w-[125%] h-auto pointer-events-none select-none"
        />

        <Image
          src="/syrup.svg"
          alt="Medication"
          width={170}
          height={170}
          className="absolute left-1/2 top-8 -translate-x-1/2"
        />

        {/* Selection Indicator */}
        <div
          className={`absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full border ${
            selected ? "border-[#2E00AB] bg-[#2E00AB]" : "border-[#2E00AB]/30 bg-white"
          }`}
        >
          {selected && <div className="h-3 w-3 rounded-full bg-white" />}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-medium text-[#2E00AB]">Wegovy®</h2>

          <span className="rounded-md bg-[#F5EEFF] px-3 py-1 text-sm font-medium text-[#2E00AB]">
            GLP-1
          </span>
        </div>

        <p className="mt-4 text-lg leading-relaxed text-[#2E00AB]/80">
          Personalized GLP-1 treatment designed to support appetite control, sustainable weight
          loss, and long-term wellness goals.
        </p>

        <h3 className="mt-5 text-[36px] font-semibold text-[#2E00AB]">$199/mo</h3>

        <button
          className={`mt-5 w-full rounded-md border py-4 text-lg font-medium transition-all ${
            selected
              ? "border-[#2E00AB] bg-[#2E00AB] text-white"
              : "border-[#2E00AB]/30 bg-white text-[#2E00AB] hover:bg-[#F8F4FF]"
          }`}
        >
          View Details
        </button>
      </div>
    </Card>
  );
}
