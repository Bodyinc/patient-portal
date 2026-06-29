"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import type { Medication } from "../_lib/onboarding-config";

type MedicationDetailsDialogProps = {
  medication: Medication | null;
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto gap-0 p-0 sm:rounded-2xl">
        <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-4">
            <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-[#F3EEFF]">
              <Image
                src="/curve-line.svg"
                alt=""
                fill
                className="pointer-events-none object-cover opacity-70"
              />
              <Image
                src={medication.imageSrc ?? "/syrup.svg"}
                alt={medication.name}
                width={160}
                height={200}
                className="relative z-10 h-auto max-h-[180px] w-auto object-contain"
              />
            </div>
            <p className="text-center text-xl font-semibold text-[#2E00AB] sm:text-left">
              From ${medication.priceMonthly}/month
            </p>
          </div>

          <div className="min-w-0">
            <DialogTitle className="text-2xl font-semibold text-[#2E00AB] sm:text-3xl">
              {medication.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detailed information about {medication.name}
            </DialogDescription>

            <p className="mt-3 text-base text-[#2E00AB]">{medication.description}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#2E00AB]/80 sm:text-base">
              {medication.detailDescription}
            </p>

            <div className="mt-5">
              <h3 className="text-base font-semibold text-[#2E00AB]">Important Information</h3>
              <ul className="mt-3 space-y-2">
                {medication.importantInfo.map((item) => (
                  <li
                    key={item}
                    className="border-l-4 border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90 sm:text-base"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-xl border border-[#2E00AB]/20 bg-[#F8F4FF] p-4">
              <h4 className="font-semibold text-[#2E00AB]">Notice</h4>
              <p className="mt-1 text-sm text-[#2E00AB]/80">{medication.notice}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#2E00AB]/10 bg-white p-4 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full border-[#2E00AB]/40 text-[#2E00AB] sm:w-auto"
          >
            Explore More
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            className="w-full bg-[#2E00AB] hover:bg-[#2E00AB]/90 sm:w-auto"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
