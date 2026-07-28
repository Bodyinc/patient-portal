"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import type { CategoryDto } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

type GoalOptionCardProps = {
  goal: CategoryDto;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
};

/** Figma goal card image: ~203×231, radius 11.79, unselected blur 14.74 */
const IMAGE_RADIUS = "rounded-[12px]";

function isUsableImageSrc(src: string | null | undefined): src is string {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export default function GoalOptionCard({ goal, selected, dimmed, onClick }: GoalOptionCardProps) {
  const imageSrc = isUsableImageSrc(goal.imageSrc) ? goal.imageSrc.trim() : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageSrc) && !imageFailed;
  const subtitle = goal.tagline?.trim() || "Starting from $70/month";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group relative mx-auto w-full max-w-[203px] text-left transition-all"
    >
      <div className="relative w-full">
        <div
          className={cn(
            "relative w-full overflow-hidden transition-[filter,opacity] duration-300 ease-out",
            IMAGE_RADIUS,
            // Blur only non-selected cards after a choice — default state stays sharp.
            dimmed && "opacity-70 blur-[15px]",
          )}
          style={dimmed ? undefined : { filter: "none", opacity: 1 }}
        >
          <div className="relative aspect-[203/231] w-full">
            {showImage && imageSrc ? (
              <img
                src={imageSrc}
                alt={goal.name}
                className={cn("absolute inset-0 h-full w-full object-cover", IMAGE_RADIUS)}
                onError={(e) => {
                  e.stopPropagation();
                  setImageFailed(true);
                }}
              />
            ) : (
              <div className={cn("absolute inset-0 bg-[#E8EEED]", IMAGE_RADIUS)} />
            )}
          </div>
        </div>

        {selected ? (
          <div className="absolute bottom-3 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#6A9B9C] sm:h-[52px] sm:w-[52px]">
            <Check className="h-6 w-6 text-white stroke-[3]" aria-hidden />
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-3 transition-opacity duration-300",
          dimmed ? "opacity-50" : "opacity-100",
        )}
      >
        <h3 className="text-[16px] font-medium leading-tight tracking-[-0.25px] text-[#152A51] sm:text-[18px]">
          {goal.name}
        </h3>
        <p className="mt-1 text-[11px] font-medium tracking-[-0.15px] text-[#152A51]/80 sm:text-[11.2px]">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
