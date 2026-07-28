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
  /** When true, never show the default vial — render nothing if DB image is missing. */
  dbOnly?: boolean;
};

export default function MedicineImage({
  src,
  alt,
  width,
  height,
  className,
  fill,
  dbOnly = false,
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
        className={cn("absolute inset-0 h-full w-full object-cover", blendClass, className)}
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
