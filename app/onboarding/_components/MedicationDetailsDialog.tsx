"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";

type MedicationDetailsDialogProps = {
  medication: MedicineDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
};

export default function MedicationDetailsDialog({
  medication,
  open,
  onOpenChange,
  onSelect,
}: MedicationDetailsDialogProps) {
  if (!medication) return null;

  function handleContinue() {
    if (!medication) return;
    onSelect(medication.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-4xl gap-0 overflow-y-auto p-6 sm:rounded-[32px]">
        {/* Main 2-Column Grid spanning the entire height */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* LEFT SIDE: Unified Card spanning full vertical height */}
          <div className="flex flex-col rounded-[24px] border border-[#DCD2FF] bg-white p-3 h-full justify-between shadow-sm">
            {/* Bottle Box: Curves on all 4 corners, stretches vertically */}
            <div className="relative flex flex-1 min-h-[380px] items-center justify-center overflow-hidden rounded-[20px] bg-[#F3EEFF] p-6">
              <Image
                src="/curve-line.svg"
                alt=""
                fill
                className="pointer-events-none object-cover opacity-70"
              />
              <MedicineImage
                src={medication.imageSrc}
                alt={medication.name}
                width={160}
                height={200}
                className="relative z-10 h-full max-h-[320px] w-auto object-contain"
              />
            </div>

            {/* Anchored price text at the bottom edge of the left card boundary */}
            <p className="mt-5 px-2 text-2xl font-bold text-[#2E00AB]">
              From ${medication.priceMonthly}/month
            </p>
          </div>

          {/* RIGHT SIDE: Details, Notice, and Buttons nested together */}
          <div className="flex flex-col justify-between min-w-0 py-1">
            <div>
              <DialogTitle className="text-4xl font-bold text-[#2E00AB] tracking-tight">
                {medication.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detailed information about {medication.name}
              </DialogDescription>

              <p className="mt-4 text-base text-[#2E00AB] leading-relaxed">
                {medication.description}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#2E00AB]/80">
                {medication.detailDescription}
              </p>

              <div className="mt-6">
                <h3 className="text-base font-bold text-[#2E00AB]">Important Information</h3>
                <ul className="mt-3 space-y-3">
                  {medication.importantInfo.map((item) => (
                    <li
                      key={item}
                      className="border-l-[3px] border-[#2E00AB] pl-3 text-sm text-[#2E00AB] leading-normal"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Notice Box matched to Figma layout shape */}
              <div className="mt-6 rounded-2xl border border-[#2E00AB]/20 bg-[#F8F4FF]/40 p-5">
                <h4 className="font-bold text-[#2E00AB] text-sm">Notice</h4>
                <p className="mt-1 text-xs text-[#2E00AB]/80 leading-relaxed">
                  {medication.notice.startsWith("*") ? medication.notice : `* ${medication.notice}`}
                </p>
              </div>
            </div>

            {/* Action Buttons: Wide, horizontally aligned, rounded layout flow */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto min-w-[160px] border-[#2E00AB]/30 text-[#2E00AB] rounded-2xl font-bold text-sm py-6 shadow-sm hover:bg-[#F8F4FF]"
              >
                Explore More
              </Button>
              <Button
                type="button"
                onClick={handleContinue}
                className="w-full sm:w-auto min-w-[160px] bg-[#2E00AB] hover:bg-[#2E00AB]/90 text-white rounded-2xl font-bold text-sm py-6 shadow-sm"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
