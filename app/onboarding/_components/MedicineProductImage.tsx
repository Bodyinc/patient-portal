"use client";

import { cn } from "@/lib/utils";

import { medicineImageFitClass, medicineImageFrameClass } from "../_lib/onboarding-theme";
import MedicineImage from "./MedicineImage";

export const MEDICINE_PRODUCT_IMAGE_ASPECT = "339 / 354.6";

type MedicineProductImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  frameClassName?: string;
  /** Fixed square thumbnail (e.g. dashboard 100×100). */
  squareSize?: number;
};

/** Shop-catalog medicine image framing — top-aligned crop with slight zoom. */
export default function MedicineProductImage({
  src,
  alt,
  className,
  frameClassName,
  squareSize,
}: MedicineProductImageProps) {
  const frameClass = frameClassName ?? medicineImageFrameClass;

  const image = src ? (
    <MedicineImage
      src={src}
      alt={alt}
      width={339}
      height={355}
      fill
      dbOnly
      fit="cover"
      position="top"
      className={medicineImageFitClass}
    />
  ) : null;

  if (squareSize) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden", frameClass, className)}
        style={{ width: squareSize, height: squareSize }}
      >
        {image}
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full", frameClass, className)}
      style={{ aspectRatio: MEDICINE_PRODUCT_IMAGE_ASPECT }}
    >
      {image}
    </div>
  );
}
