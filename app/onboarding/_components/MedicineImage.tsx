"use client";

import Image from "next/image";
import { useState } from "react";

import {
  DEFAULT_MEDICINE_IMAGE,
  getDbMedicineImageSrc,
  isExternalMedicineImage,
  resolveMedicineImageSrc,
} from "@/lib/intake/medicine-image";

type MedicineImageProps = {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fill?: boolean;
  /** When true, never show `/syrup.svg` — render nothing if DB image is missing. */
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
  const external = imgSrc ? isExternalMedicineImage(imgSrc) : false;

  if (!imgSrc) return null;

  if (fill) {
    return (
      <Image
        src={imgSrc}
        alt={alt}
        fill
        unoptimized={external}
        className={className}
        onError={() => setImgSrc(dbOnly ? null : DEFAULT_MEDICINE_IMAGE)}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      unoptimized={external}
      className={className}
      onError={() => setImgSrc(dbOnly ? null : DEFAULT_MEDICINE_IMAGE)}
    />
  );
}
