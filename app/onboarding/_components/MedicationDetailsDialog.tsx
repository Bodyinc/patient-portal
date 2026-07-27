"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { formatFromPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  fieldControlClass,
  medicineImageFrameClass,
  medicineImageFitClass,
} from "../_lib/onboarding-theme";

type MedicationDetailsDialogProps = {
  medication: MedicineDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string, variantId: string | null) => void;
};

const IMAGE_ASPECT = "339 / 354.6";

export default function MedicationDetailsDialog({
  medication,
  open,
  onOpenChange,
  onSelect,
}: MedicationDetailsDialogProps) {
  const variants = medication?.variants ?? [];
  const hasVariants = variants.length > 0;
  const defaultVariantId = useMemo(() => {
    if (!hasVariants) return null;
    return [...variants].sort(
      (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
    )[0].id;
  }, [hasVariants, variants]);
  const [variantId, setVariantId] = useState<string | null>(defaultVariantId);

  if (!medication) return null;

  const selectedVariant = hasVariants ? (variants.find((v) => v.id === variantId) ?? null) : null;
  const displayFromPriceCents = hasVariants
    ? (selectedVariant?.fromPriceCents ?? null)
    : medication.fromPriceCents;

  function handleContinue() {
    if (!medication) return;
    onSelect(medication.id, variantId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-4xl gap-0 overflow-y-auto scrollbar-hide rounded-[24px] border-[#E8EEED] p-4 sm:rounded-[24px] sm:p-6">
        <div className="grid grid-cols-1 gap-6 onboarding-font lg:grid-cols-[minmax(0,339px)_1fr]">
          <div className="flex h-full flex-col justify-between rounded-[24px] border border-[#E8EEED] bg-white p-3">
            <div
              className={cn("w-full", medicineImageFrameClass)}
              style={{ aspectRatio: IMAGE_ASPECT }}
            >
              <MedicineImage
                src={medication.imageSrc}
                alt={medication.name}
                width={339}
                height={355}
                fill
                dbOnly
                className={medicineImageFitClass}
              />
            </div>

            <div className="mt-4 space-y-2.5 px-1">
              {hasVariants ? (
                <select
                  value={variantId ?? ""}
                  onChange={(e) => setVariantId(e.target.value)}
                  className={cn("w-full text-[14px]", fieldControlClass)}
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.fromPriceCents == null ? " — coming soon" : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              <p className="text-[22px] font-medium tracking-[-0.3px] text-[#152A51] sm:text-[24px]">
                {formatFromPrice(displayFromPriceCents)}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between py-1">
            <div>
              <DialogTitle className="text-[28px] font-medium leading-tight tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
                {medication.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detailed information about {medication.name}
              </DialogDescription>

              <p className="mt-4 text-[15px] leading-relaxed text-[#152A51]">
                {medication.description}
              </p>
              {medication.detailDescription ? (
                <p className="mt-3 text-[14px] leading-relaxed text-[#152A51]/80">
                  {medication.detailDescription}
                </p>
              ) : null}

              {medication.importantInfo.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-[15px] font-medium text-[#152A51]">Important Information</h3>
                  <ul className="mt-3 space-y-3">
                    {medication.importantInfo.map((item) => (
                      <li
                        key={item}
                        className="border-l-[3px] border-[#6A9B9C] pl-3 text-[14px] leading-normal text-[#152A51]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {medication.notice ? (
                <div className="mt-6 rounded-[16px] border border-[#E8EEED] bg-[#F3F6F6] p-4 sm:p-5">
                  <h4 className="text-[13px] font-medium text-[#152A51]">Notice</h4>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#152A51]/80">
                    {medication.notice.startsWith("*")
                      ? medication.notice
                      : `* ${medication.notice}`}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-[46px] w-full rounded-full border-[#152A51]/30 bg-transparent px-6 text-[14px] font-medium text-[#152A51] shadow-none hover:bg-[#152A51]/5 sm:w-auto"
              >
                Explore More
              </Button>
              <Button
                type="button"
                onClick={handleContinue}
                className="h-[46px] w-full rounded-full bg-[#E3E084] px-6 text-[14px] font-medium text-[#152A51] shadow-none hover:bg-[#D9D674] sm:w-auto"
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
