"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { formatFromPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { fieldControlClass } from "../_lib/onboarding-theme";

type MedicationCardProps = {
  medication: MedicineDto;
  selected?: boolean;
  /** When this medicine is the page selection, keep card variant/price in sync. */
  activeVariantId?: string | null;
  accentIndex?: number;
  onSelect?: (id: string, variantId: string | null) => void;
  onViewDetails?: (id: string) => void;
};

const IMAGE_ASPECT = "386 / 359";

/** Figma medication card image well — light surface, vial fills frame with small edge padding. */
const medicationCardImageFrameClass =
  "relative w-full shrink-0 overflow-hidden rounded-[20px] bg-[#E8EEED]";

export default function MedicationCard({
  medication,
  selected = false,
  activeVariantId = null,
  onSelect,
  onViewDetails,
}: MedicationCardProps) {
  const hasVariants = medication.variants.length > 0;
  const defaultVariantId = useMemo(() => {
    if (!hasVariants) return null;
    return [...medication.variants].sort(
      (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
    )[0].id;
  }, [hasVariants, medication.variants]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(defaultVariantId);

  useEffect(() => {
    setSelectedVariantId(defaultVariantId);
  }, [defaultVariantId]);

  useEffect(() => {
    if (!activeVariantId) return;
    if (!medication.variants.some((v) => v.id === activeVariantId)) return;
    setSelectedVariantId(activeVariantId);
  }, [activeVariantId, medication.variants]);

  const selectedVariant = hasVariants
    ? (medication.variants.find((v) => v.id === selectedVariantId) ?? null)
    : null;
  const displayFromPriceCents =
    (hasVariants ? selectedVariant?.fromPriceCents : null) ?? medication.fromPriceCents;

  function chooseMedication(variantId: string | null = selectedVariantId) {
    onSelect?.(medication.id, hasVariants ? variantId : null);
  }

  const tagLabel = medication.tag?.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => chooseMedication()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          chooseMedication();
        }
      }}
      className={cn(
        "relative flex h-full w-full min-w-0 max-w-[386px] cursor-pointer flex-col rounded-[20px] border border-[#E8EEED] bg-white p-3 transition-all onboarding-font sm:p-4",
        selected && "ring-2 ring-inset ring-[#6A9B9C]/40",
      )}
    >
      <div className={medicationCardImageFrameClass} style={{ aspectRatio: IMAGE_ASPECT }}>
        <div className="absolute inset-x-[10%] top-[4%] bottom-[1%]">
          <MedicineImage
            src={medication.imageSrc}
            alt={medication.name}
            width={177}
            height={316}
            fill
            fit="contain"
            position="center bottom"
            className="object-contain object-bottom mix-blend-normal"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 pt-3 sm:gap-2.5 sm:pt-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-[16px] font-medium leading-snug tracking-[-0.25px] text-[#152A51] sm:text-[18px]">
            {medication.name}
          </h2>
          {tagLabel ? (
            <span className="shrink-0 rounded-full bg-[#F3F6F6] px-2.5 py-1 text-[11px] font-medium leading-none text-[#152A51]">
              {tagLabel}
            </span>
          ) : null}
        </div>

        {medication.description ? (
          <p className="line-clamp-3 text-[13px] font-normal leading-snug text-[#152A51]/70 sm:text-[14px]">
            {medication.description}
          </p>
        ) : null}

        <p className="text-[18px] font-medium leading-none tracking-[-0.3px] text-[#152A51] sm:text-[20px]">
          {formatFromPrice(displayFromPriceCents)}
        </p>

        {hasVariants ? (
          <div className="min-w-0 w-full pt-0.5" onClick={(e) => e.stopPropagation()}>
            <label className="mb-1.5 block text-[12px] font-normal text-[#152A51]/70">
              Select option
            </label>
            <select
              value={selectedVariantId ?? ""}
              onChange={(e) => {
                const nextVariantId = e.target.value;
                setSelectedVariantId(nextVariantId);
                chooseMedication(nextVariantId);
              }}
              className={cn(
                "min-w-0 w-full max-w-full text-[13px] sm:text-[14px]",
                fieldControlClass,
              )}
            >
              {medication.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.fromPriceCents == null ? " — coming soon" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {onViewDetails ? (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(medication.id);
              }}
              className="h-[40px] shrink-0 rounded-full border border-[#152A51]/25 bg-white px-4 text-[13px] font-medium text-[#152A51] transition hover:bg-[#F3F6F6] sm:text-[14px]"
            >
              View Details
            </button>
          </div>
        ) : null}

        {medication.notice.trim() ? (
          <p className="text-[11px] font-normal leading-snug text-[#152A51]/55 sm:text-[12px]">
            {medication.notice.startsWith("Note:")
              ? medication.notice
              : `Note: ${medication.notice}`}
          </p>
        ) : null}

        <div className="mt-auto pt-2">
          <span
            className={cn(
              "inline-flex h-[46px] w-[121px] items-center justify-center gap-2 rounded-full text-[14px] font-medium leading-none text-[#152A51] transition",
              selected ? "bg-[#E3E084]" : "border border-[#152A51]/15 bg-white",
            )}
            aria-hidden
          >
            {selected ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#152A51]/10">
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              </span>
            ) : (
              <span className="h-6 w-6 rounded-full border-2 border-[#152A51]/15" />
            )}
            Select
          </span>
        </div>
      </div>
    </div>
  );
}
