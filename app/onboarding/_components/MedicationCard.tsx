"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { formatMonthly } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { fieldControlClass, MEDICATION_BADGE_ACCENTS, ONBOARDING } from "../_lib/onboarding-theme";

type MedicationCardProps = {
  medication: MedicineDto;
  selected?: boolean;
  accentIndex?: number;
  onSelect?: (id: string, variantId: string | null) => void;
  onViewDetails?: (id: string) => void;
};

const HIGHLIGHT_BADGE_RE = /popular|highest|best|fastest|maximum|most/i;
const DOSAGE_BADGE_RE = /\b(\d+(\.\d+)?\s*mg|size\s*\d|\d+(\.\d+)?\s*ml)\b/i;
const MAX_SECONDARY_BADGES = 3;

function PlansFromBadge({ fromPriceCents }: { fromPriceCents: number | null }) {
  if (fromPriceCents == null) {
    return (
      <span className="rounded-full bg-white px-4 py-2 text-center text-[12px] font-medium leading-none text-[#152A51] shadow-[0_4px_14px_rgba(0,0,0,0.16)] sm:text-[13px]">
        Pricing coming soon
      </span>
    );
  }

  return (
    <span className="rounded-full bg-white px-4 py-2 text-center text-[12px] font-medium leading-none text-[#152A51] shadow-[0_4px_14px_rgba(0,0,0,0.16)] sm:text-[13px]">
      Plans from{" "}
      <span className="text-[15px] font-bold sm:text-[16px]">{formatMonthly(fromPriceCents)}</span>
      /mo
    </span>
  );
}

function pickHighlightIndex(badges: string[]): number {
  if (badges.length === 0) return -1;
  const match = badges.findIndex((b) => HIGHLIGHT_BADGE_RE.test(b));
  return match >= 0 ? match : 0;
}

function featureBadges(medication: MedicineDto): string[] {
  const variantNames = new Set(
    medication.variants.map((v) => v.name.trim().toLowerCase()).filter(Boolean),
  );
  return medication.importantInfo
    .map((b) => b.trim())
    .filter(Boolean)
    .filter((b) => !variantNames.has(b.toLowerCase()))
    .filter((b) => !DOSAGE_BADGE_RE.test(b));
}

export default function MedicationCard({
  medication,
  selected = false,
  accentIndex = 0,
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

  const [variantId, setVariantId] = useState<string | null>(defaultVariantId);
  const selectedVariant = hasVariants
    ? (medication.variants.find((v) => v.id === variantId) ?? null)
    : null;
  const displayFromPriceCents =
    (hasVariants ? selectedVariant?.fromPriceCents : null) ?? medication.fromPriceCents;

  const badges = featureBadges(medication);
  const highlightIndex = pickHighlightIndex(badges);
  const highlightBadge = highlightIndex >= 0 ? badges[highlightIndex] : null;
  const secondaryBadges = badges
    .filter((_, i) => i !== highlightIndex)
    .slice(0, MAX_SECONDARY_BADGES);
  const solidAccent =
    MEDICATION_BADGE_ACCENTS[accentIndex % MEDICATION_BADGE_ACCENTS.length] ??
    ONBOARDING.badgeOrchid;

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
        "relative flex h-auto w-full cursor-pointer flex-col overflow-visible rounded-[24px] border bg-white shadow-[0_2px_16px_rgba(21,42,81,0.08)] transition-all onboarding-font sm:flex-row sm:items-stretch",
        selected
          ? "border-[#152A51]/30 ring-2 ring-[#6A9B9C]/20"
          : "border-[#E8EEED] hover:border-[#152A51]/20",
      )}
    >
      {/* Left: product shot + centered price pill */}
      <div className="relative isolate h-[220px] w-full shrink-0 overflow-hidden rounded-t-[23px] bg-[#5A778D] sm:h-auto sm:min-h-[200px] sm:w-[38%] sm:max-w-[300px] sm:rounded-l-[23px] sm:rounded-tr-none">
        <div className="absolute inset-0 flex items-end justify-center pb-1 pt-3">
          <MedicineImage
            src={medication.imageSrc}
            alt={medication.name}
            width={280}
            height={320}
            fill
            className="object-contain object-bottom px-3 pb-2 pt-1"
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
          <PlansFromBadge fromPriceCents={displayFromPriceCents} />
        </div>

        {medication.tag ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 text-center text-[11px] font-medium leading-snug text-white/90 sm:text-[12px]">
            {medication.tag}
          </p>
        ) : null}
      </div>

      {/* Right: title, badge, description, controls */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-5 py-5 pr-12 sm:gap-3 sm:px-6 sm:py-6 sm:pr-14">
        <div className="min-w-0 space-y-2 pr-1">
          <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[19px]">
            {medication.name}
          </h2>

          {highlightBadge ? (
            <span
              className="inline-flex rounded-full px-3 py-1 text-[11px] font-medium leading-none text-white sm:text-[12px]"
              style={{ backgroundColor: solidAccent }}
            >
              {highlightBadge}
            </span>
          ) : null}

          {medication.description ? (
            <p className="text-[13px] font-normal leading-snug text-[#152A51]/70 sm:text-[14px]">
              {medication.description}
            </p>
          ) : null}
        </div>

        {secondaryBadges.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {secondaryBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-[#D5D9E0] bg-white px-2.5 py-1 text-[11px] font-medium leading-none text-[#152A51] sm:text-[12px]"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        {(hasVariants || onViewDetails) && (
          <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:items-center sm:gap-3">
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
                className={cn("h-[40px] min-w-0 flex-1 text-[13px]", fieldControlClass)}
                aria-label="Select variant"
              >
                {medication.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.fromPriceCents == null ? " — coming soon" : ""}
                  </option>
                ))}
              </select>
            ) : null}

            {onViewDetails ? (
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
            ) : null}
          </div>
        )}
      </div>

      {/* Selection indicator — overlaps card edge per Figma */}
      <div
        className={cn(
          "absolute -right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition sm:-right-4 sm:h-10 sm:w-10",
          selected ? "border-[#6A9B9C] bg-[#6A9B9C]" : "border-[#D5D9E0] bg-white",
        )}
        aria-hidden
      >
        {selected ? <Check className="h-5 w-5 text-white stroke-[2.5]" /> : null}
      </div>
    </div>
  );
}
