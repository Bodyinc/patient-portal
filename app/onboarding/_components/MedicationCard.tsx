"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";

import MedicineImage from "./MedicineImage";
import type { MedicineDto } from "@/lib/intake/types";
import { formatMonthly } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { MEDICATION_BADGE_ACCENTS, ONBOARDING } from "../_lib/onboarding-theme";

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

/** Figma card 856×355 — left image is roughly square within that height */
const IMAGE_PANEL_CLASS =
  "relative isolate h-[220px] w-full shrink-0 overflow-hidden rounded-t-[35px] bg-[#5A778D] sm:h-full sm:w-[320px] sm:rounded-l-[35px] sm:rounded-tr-none";

/** Figma: price oval 259 × 74 */
function PlansFromBadge({ fromPriceCents }: { fromPriceCents: number | null }) {
  if (fromPriceCents == null) {
    return (
      <span className="flex h-[58px] w-[min(259px,calc(100%-1.5rem))] items-center justify-center rounded-full bg-white text-center text-[13px] font-medium leading-none text-[#152A51] shadow-[0_4px_14px_rgba(0,0,0,0.16)] sm:h-[74px]">
        Pricing coming soon
      </span>
    );
  }

  return (
    <span className="flex h-[58px] w-[min(259px,calc(100%-1.5rem))] items-center justify-center gap-1 rounded-full bg-white text-center text-[13px] font-medium leading-none text-[#152A51] shadow-[0_4px_14px_rgba(0,0,0,0.16)] sm:h-[74px] sm:text-[14px]">
      Plans from{" "}
      <span className="text-[18px] font-bold tracking-[-0.3px] sm:text-[22px]">
        {formatMonthly(fromPriceCents)}
        <span className="text-[13px] font-medium sm:text-[14px]">/mo</span>
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
  accentIndex = 0,
  onSelect,
  onViewDetails,
}: MedicationCardProps) {
  const hasVariants = medication.variants.length > 0;
  // Cheapest variant is used for pricing + selection; dosage is chosen in details.
  const defaultVariantId = useMemo(() => {
    if (!hasVariants) return null;
    return [...medication.variants].sort(
      (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
    )[0].id;
  }, [hasVariants, medication.variants]);

  const selectedVariant = hasVariants
    ? (medication.variants.find((v) => v.id === defaultVariantId) ?? null)
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
      onClick={() => onSelect?.(medication.id, defaultVariantId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(medication.id, defaultVariantId);
        }
      }}
      className={cn(
        // Figma Rectangle 90: 856×355, radius 37, border 2 #E8EEED, shadow 0 15 40
        "relative flex h-auto w-full max-w-[856px] cursor-pointer flex-col overflow-visible rounded-[37px] border-2 border-[#E8EEED] bg-white shadow-[0_15px_40px_rgba(59,71,89,0.10)] transition-all onboarding-font sm:h-[355px] sm:flex-row sm:items-stretch",
        selected && "ring-2 ring-[#6A9B9C]/25",
      )}
    >
      {/* Left: product shot — zoomed enough to slice base at “Multiple dose”, keep slate bg visible */}
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

      {/* Right: title, badge, description, controls */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-5 py-5 pr-12 sm:gap-3 sm:px-6 sm:py-6 sm:pr-14">
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
