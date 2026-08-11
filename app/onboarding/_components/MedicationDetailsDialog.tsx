"use client";

import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import MedicationDetailsLayout from "./MedicationDetailsLayout";
import type { MedicineDto } from "@/lib/intake/types";
import { cn } from "@/lib/utils";
import { fieldControlClass } from "../_lib/onboarding-theme";

type MedicationDetailsDialogProps = {
  medication: MedicineDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string, variantId: string | null) => void;
  initialVariantId?: string | null;
};

export default function MedicationDetailsDialog({
  medication,
  open,
  onOpenChange,
  onSelect,
  initialVariantId = null,
}: MedicationDetailsDialogProps) {
  const variants = useMemo(() => medication?.variants ?? [], [medication?.variants]);
  const hasVariants = variants.length > 0;
  const defaultVariantId = useMemo(() => {
    if (!hasVariants) return null;
    if (initialVariantId && variants.some((v) => v.id === initialVariantId)) {
      return initialVariantId;
    }
    return [...variants].sort(
      (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
    )[0].id;
  }, [hasVariants, variants, initialVariantId]);
  const [variantId, setVariantId] = useState<string | null>(defaultVariantId);
  const [importantOpen, setImportantOpen] = useState(false);

  useEffect(() => {
    if (!open) setImportantOpen(false);
  }, [open]);

  useEffect(() => {
    setVariantId(defaultVariantId);
  }, [defaultVariantId]);

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

  const variantSelect = hasVariants ? (
    <div className="space-y-2.5">
      <label className="text-[14px] font-normal text-[#152A51]">Select option</label>
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
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[95vh] gap-0 overflow-y-auto scrollbar-hide border-0 bg-transparent p-2 shadow-none sm:p-3 [&>button]:right-6 [&>button]:top-6 [&>button]:z-10",
          importantOpen ? "max-w-[min(96vw,1480px)]" : "max-w-[min(96vw,820px)]",
        )}
      >
        <MedicationDetailsLayout
          className="onboarding-font"
          name={medication.name}
          description={medication.description}
          detailDescription={medication.detailDescription}
          imageSrc={medication.imageSrc}
          fromPriceCents={displayFromPriceCents}
          variantSelect={variantSelect}
          importantInfo={medication.importantInfo}
          notice={medication.notice}
          importantOpen={importantOpen}
          onImportantOpenChange={setImportantOpen}
          onExploreMore={() => onOpenChange(false)}
          onContinue={handleContinue}
        />
      </DialogContent>
    </Dialog>
  );
}
