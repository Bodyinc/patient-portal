"use client";

import { useMemo, useState } from "react";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { formatFromPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  fieldControlClass,
  medicineImageFrameClass,
  medicineImageFitClass,
} from "../_lib/onboarding-theme";

type MedicationCardProps = {
  medication: MedicineDto;
  selected?: boolean;
  onSelect?: (id: string, variantId: string | null) => void;
  onViewDetails?: (id: string) => void;
};

/** Figma treatment image aspect (~339 × 354.6) */
const IMAGE_ASPECT = "339 / 354.6";

export default function MedicationCard({
  medication,
  selected = false,
  onSelect,
  onViewDetails,
}: MedicationCardProps) {
  const hasVariants = medication.variants.length > 0;
  // The variant dropdown is shown on the card (defaulting to the cheapest) so patients see the
  // options even if they hit Continue without opening details.
  const defaultVariantId = useMemo(() => {
    if (!hasVariants) return null;
    return [...medication.variants].sort(
      (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
    )[0].id;
  }, [hasVariants, medication.variants]);

  const [variantId, setVariantId] = useState<string | null>(defaultVariantId);
  const selectedVariant = hasVariants
    ? (medication.variants.find((v) => v.id === variantId) ?? null)
    : null;
  const displayFromPriceCents = hasVariants
    ? (selectedVariant?.fromPriceCents ?? null)
    : medication.fromPriceCents;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(medication.id, variantId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(medication.id, variantId);
        }
      }}
      className={cn(
        "flex h-full w-full max-w-full cursor-pointer flex-col overflow-hidden rounded-[24px] border bg-white p-3 shadow-none transition-all onboarding-font sm:p-4",
        selected
          ? "border-[#152A51] ring-2 ring-[#152A51]/15"
          : "border-[#E8EEED] hover:border-[#152A51]/30",
      )}
    >
      <div
        className={cn("w-full shrink-0", medicineImageFrameClass)}
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

        <div
          className={cn(
            "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2",
            selected ? "border-[#152A51] bg-[#152A51]" : "border-[#152A51]/25 bg-white",
          )}
        >
          {selected ? <div className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 pt-3 sm:gap-2.5 sm:pt-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[16px] font-medium leading-snug tracking-[-0.25px] text-[#152A51] sm:text-[18px]">
            {medication.name}
          </h2>
          {medication.tag ? (
            <span className="shrink-0 rounded-full bg-[#F3F6F6] px-2.5 py-1 text-[11px] font-medium text-[#152A51] sm:text-xs">
              {medication.tag}
            </span>
          ) : null}
        </div>

        {medication.requiresQuestionnaire ? (
          <span className="w-fit rounded-full bg-[#E8EEED] px-2.5 py-1 text-[11px] font-medium text-[#152A51]">
            Screening required
          </span>
        ) : null}

        <p className="line-clamp-2 text-[13px] leading-snug text-[#152A51]/80 sm:text-[14px]">
          {medication.description}
        </p>

        <div className="mt-auto space-y-2.5 pt-3">
          {hasVariants ? (
            <select
              value={variantId ?? ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                const next = e.target.value;
                setVariantId(next);
                onSelect?.(medication.id, next);
              }}
              className={cn("w-full text-[13px]", fieldControlClass)}
            >
              {medication.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.fromPriceCents == null ? " — coming soon" : ""}
                </option>
              ))}
            </select>
          ) : null}

          <h3 className="text-[20px] font-medium leading-none tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
            {formatFromPrice(displayFromPriceCents)}
          </h3>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(medication.id);
            }}
            className="h-[42px] w-full rounded-full border border-[#152A51]/30 bg-white text-[13px] font-medium text-[#152A51] transition hover:bg-[#F3F6F6] sm:h-[46px] sm:text-[14px]"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
