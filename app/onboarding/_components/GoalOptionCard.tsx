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
            "relative w-full overflow-hidden transition-opacity duration-300 ease-out",
            IMAGE_RADIUS,
            dimmed ? "opacity-70" : "opacity-100",
          )}
        >
          <div className="relative aspect-[203/231] w-full">
            {showImage && imageSrc ? (
              <img
                src={imageSrc}
                alt={goal.name}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-out",
                  dimmed
                    ? "blur-[5px] scale-[1.04] saturate-100 brightness-100"
                    : "blur-0 scale-100",
                )}
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
          /* Moved to bottom-left to match your screenshot */
          <div className="absolute bottom-3 left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full   bg-[#6A9B9C] sm:bottom-4 sm:left-4 sm:h-[62px] sm:w-[62px]">
            <Check className="h-8 w-8 text-white stroke-[3px]" aria-hidden />
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
