"use client";

import { cn } from "@/lib/utils";

import {
  MEDICATION_CARD_IMAGE_ASPECT,
  medicineImageFitClass,
  medicineImageFrameClass,
} from "../_lib/onboarding-theme";
import MedicineImage from "./MedicineImage";

/** @deprecated Prefer MEDICATION_CARD_IMAGE_ASPECT */
export const MEDICINE_PRODUCT_IMAGE_ASPECT = MEDICATION_CARD_IMAGE_ASPECT;

/** Figma vial export frame */
const VIAL_ASPECT = "133 / 200";

type MedicineProductImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  frameClassName?: string;
  /** Fixed square thumbnail (e.g. checkout 80×80). */
  squareSize?: number;
  /** Fill a parent that already defines width/height (treatment row bottle well). */
  fillParent?: boolean;
  /** Only show DB images (shop). Onboarding may pass false to allow default vial. */
  dbOnly?: boolean;
};

/**
 * Shared medicine image framing.
 * Every admin 133×200 upload is placed in the same height-filled portrait slot
 * so bottles render at one consistent size (shop catalog, details, checkout, etc.).
 */
export default function MedicineProductImage({
  src,
  alt,
  className,
  frameClassName,
  squareSize,
  fillParent = false,
  dbOnly = true,
}: MedicineProductImageProps) {
  const frameClass = frameClassName ?? medicineImageFrameClass;

  const framedImage = src ? (
    <div className="absolute inset-0 flex items-end justify-center px-[6%] pt-[2%]">
      <div
        className="relative h-full max-h-full w-auto max-w-full"
        style={{ aspectRatio: VIAL_ASPECT }}
      >
        <MedicineImage
          src={src}
          alt={alt}
          width={133}
          height={200}
          fill
          dbOnly={dbOnly}
          fit="contain"
          position="center bottom"
          className={medicineImageFitClass}
        />
      </div>
    </div>
  ) : null;

  if (fillParent) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", frameClass, className)}>
        {framedImage}
      </div>
    );
  }

  if (squareSize) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden", frameClass, className)}
        style={{ width: squareSize, height: squareSize }}
      >
        {framedImage}
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full", frameClass, className)}
      style={{ aspectRatio: MEDICATION_CARD_IMAGE_ASPECT }}
    >
      {framedImage}
    </div>
  );
}
