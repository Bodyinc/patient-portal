"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { toResizedPublicImageSrc } from "@/lib/intake/medicine-image";
import type { CategoryDto } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

type GoalOptionCardProps = {
  goal: CategoryDto;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  priority?: boolean;
};

const IMAGE_RADIUS = "rounded-[12px]";
const IMAGE_SIZES = "(max-width: 640px) 50vw, 25vw";

function isUsableImageSrc(src: string | null | undefined): src is string {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export default function GoalOptionCard({
  goal,
  selected,
  dimmed,
  onClick,
  priority = false,
}: GoalOptionCardProps) {
  const imageSrc = isUsableImageSrc(goal.imageSrc) ? goal.imageSrc.trim() : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageSrc) && !imageFailed;
  const subtitle = goal.tagline?.trim() || "Starting from $70/month";
  const src1x = imageSrc ? toResizedPublicImageSrc(imageSrc, { width: 406, quality: 70 }) : null;
  const src2x = imageSrc ? toResizedPublicImageSrc(imageSrc, { width: 812, quality: 70 }) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group relative w-full text-left"
    >
      <div className="relative w-full">
        <div
          className={cn(
            "relative w-full overflow-hidden",
            IMAGE_RADIUS,
            dimmed ? "opacity-70" : "opacity-100",
          )}
        >
          <div className={cn("relative aspect-[203/231] w-full bg-[#E8EEED]", IMAGE_RADIUS)}>
            {showImage && src1x && src2x && imageSrc ? (
              <img
                src={src1x}
                srcSet={`${src1x} 406w, ${src2x} 812w`}
                sizes={IMAGE_SIZES}
                alt={goal.name}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "low"}
                decoding="async"
                className={cn(
                  "absolute inset-0 h-full w-full object-cover",
                  dimmed
                    ? "blur-[5px] scale-[1.04] saturate-100 brightness-100"
                    : "blur-0 scale-100",
                )}
                onError={(event) => {
                  const img = event.currentTarget;
                  if (img.src !== imageSrc) {
                    img.srcset = "";
                    img.src = imageSrc;
                    return;
                  }
                  setImageFailed(true);
                }}
              />
            ) : null}
          </div>
        </div>

        {selected ? (
          <div className="absolute bottom-3 left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full   bg-[#6A9B9C] sm:bottom-4 sm:left-4 sm:h-[62px] sm:w-[62px]">
            <Check className="h-8 w-8 text-white stroke-[3px]" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className={cn("mt-3", dimmed ? "opacity-50" : "opacity-100")}>
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
