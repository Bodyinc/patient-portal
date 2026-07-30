"use client";

import { useState } from "react";

import {
  DEFAULT_MEDICINE_IMAGE,
  getDbMedicineImageSrc,
  resolveMedicineImageSrc,
} from "@/lib/intake/medicine-image";
import { cn } from "@/lib/utils";

type MedicineImageProps = {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fill?: boolean;
  /** Only render a database image; hide the frame when no image is available. */
  dbOnly?: boolean;
  fit?: "cover" | "contain";
  position?: string;
};

export default function MedicineImage({
  src,
  alt,
  width,
  height,
  className,
  fill,
  dbOnly = false,
  fit = "contain",
  position,
}: MedicineImageProps) {
  const initial = dbOnly ? getDbMedicineImageSrc(src) : resolveMedicineImageSrc(src);
  const [imgSrc, setImgSrc] = useState<string | null>(initial);
  const isDefaultVial = imgSrc === DEFAULT_MEDICINE_IMAGE;

  if (!imgSrc) return null;

  const blendClass = isDefaultVial ? "mix-blend-screen" : undefined;

  // Plain img for dynamic DB URLs — next/image can surface failed loads as unhandled [object Event].
  if (fill) {
    return (
      <img
        src={imgSrc}
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full",
          fit === "cover" ? "object-cover" : "object-contain",
          blendClass,
          className,
        )}
        style={position ? { objectPosition: position } : undefined}
        onError={(e) => {
          e.stopPropagation();
          setImgSrc(dbOnly ? null : DEFAULT_MEDICINE_IMAGE);
        }}
      />
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={cn(blendClass, className)}
      onError={(e) => {
        e.stopPropagation();
        setImgSrc(dbOnly ? null : DEFAULT_MEDICINE_IMAGE);
      }}
    />
  );
}
