"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { formatMonthly } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { fieldControlClass, MEDICATION_BADGE_ACCENTS, ONBOARDING } from "../_lib/onboarding-theme";

type MedicationCardProps = {
  medication: MedicineDto;
  selected?: boolean;
  /** When this medicine is the page selection, keep card variant/price in sync. */
  activeVariantId?: string | null;
  accentIndex?: number;
  onSelect?: (id: string, variantId: string | null) => void;
  onViewDetails?: (id: string) => void;
};

const HIGHLIGHT_BADGE_RE = /popular|highest|best|fastest|maximum|most/i;
const DOSAGE_BADGE_RE = /\b(\d+(\.\d+)?\s*mg|size\s*\d|\d+(\.\d+)?\s*ml)\b/i;
const MAX_SECONDARY_BADGES = 3;

/** Fixed dimensions for image panel on desktop to prevent variable card width/height */
const IMAGE_PANEL_CLASS =
  "relative isolate aspect-[339/354.6] w-full shrink-0 overflow-hidden rounded-[35px] bg-[#5A778D] sm:aspect-none sm:h-[355px] sm:w-[320px]";

/** Figma: Price Oval */
function PlansFromBadge({ fromPriceCents }: { fromPriceCents: number | null }) {
  if (fromPriceCents == null) {
    return (
      <span className="flex h-[58px] w-[min(259px,calc(100%-1.5rem))] items-center justify-center rounded-full bg-white text-center text-[13px] font-medium leading-none text-[#152A51] shadow-[0_4px_14px_rgba(0,0,0,0.16)] sm:h-[74px]">
        Pricing coming soon
      </span>
    );
  }

  return (
    <span className="flex h-[58px] w-[min(259px,calc(100%-1.5rem))] items-center justify-center gap-1 rounded-full bg-white text-center text-[13px] font-medium leading-none text-[#152A51] shadow-[0_4px_14px_rgba(0,0,0,0.16)] sm:h-[60px] sm:text-[14px]">
      <span className="flex items-end text-[15px] font-medium sm:text-[15px]">Plans from</span>
      <span className="text-[18px] font-bold tracking-[-0.3px] sm:text-[28px]">
        {formatMonthly(fromPriceCents)}
        <span className="text-[13px] font-medium sm:text-[20px]">/mo</span>
      </span>
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
  activeVariantId = null,
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

  const badges = featureBadges(medication);
  const highlightIndex = pickHighlightIndex(badges);
  const highlightBadge = highlightIndex >= 0 ? badges[highlightIndex] : null;
  const secondaryBadges = badges
    .filter((_, i) => i !== highlightIndex)
    .slice(0, MAX_SECONDARY_BADGES);
  const solidAccent =
    MEDICATION_BADGE_ACCENTS[accentIndex % MEDICATION_BADGE_ACCENTS.length] ??
    ONBOARDING.badgeOrchid;

  function chooseMedication(variantId: string | null = selectedVariantId) {
    onSelect?.(medication.id, hasVariants ? variantId : null);
  }

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
        // Strict box model: full width (856px max), fixed height on sm, flex row stretch
        "relative mx-auto flex h-auto w-full max-w-[856px] shrink-0 cursor-pointer flex-col overflow-visible rounded-[37px] border-2 border-[#E8EEED] bg-white shadow-[0_15px_40px_rgba(59,71,89,0.10)] transition-all onboarding-font sm:h-[355px] sm:flex-row sm:items-stretch",
        selected && "ring-2 ring-[#6A9B9C]/25",
      )}
    >
      {/* Left: product shot */}
      <div className={IMAGE_PANEL_CLASS}>
        <MedicineImage
          src={medication.imageSrc}
          alt={medication.name}
          width={180}
          height={180}
          fill
          fit="cover"
          position="center 50%"
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-3">
          <PlansFromBadge fromPriceCents={displayFromPriceCents} />
        </div>
      </div>

      {/* Right: title, badges, description, controls */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-5 py-5 pr-14 sm:gap-3 sm:px-6 sm:py-6 sm:pr-16">
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

        <div className="min-w-0 space-y-2 pr-1">
          <h2 className="text-[17px] font-medium leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[30px]">
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
            <p className="line-clamp-3 text-[13px] font-normal leading-snug text-[#152A51]/70 sm:text-[14px]">
              {medication.description}
            </p>
          ) : null}
        </div>

        {hasVariants ? (
          <div className="max-w-[240px] pt-0.5" onClick={(e) => e.stopPropagation()}>
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
              className={cn("w-full text-[13px] sm:text-[14px]", fieldControlClass)}
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
          <p className="mt-1 text-[11px] font-normal leading-snug text-[#152A51]/55 sm:text-[12px]">
            {medication.notice.startsWith("Note:")
              ? medication.notice
              : `Note: ${medication.notice}`}
          </p>
        ) : null}
      </div>

      {/* Figma Selection Ellipse (114px x 114px) overlapping right edge */}
      <div
        className={cn(
          "absolute -right-7 top-1/2 z-20 flex h-[80px] w-[80px] -translate-y-1/2 items-center justify-center rounded-full border-2 transition sm:-right-10 sm:h-[114px] sm:w-[114px]",
          selected ? "border-white bg-[#6A9B9C]" : "border-[#E8EEED] bg-white",
        )}
        aria-hidden
      >
        {selected ? <Check className="h-10 w-10 text-white stroke-[3] sm:h-12 sm:w-12" /> : null}
      </div>
    </div>
  );
}
