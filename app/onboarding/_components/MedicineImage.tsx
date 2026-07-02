"use client";

import Image from "next/image";
import { useState } from "react";

import {
  DEFAULT_MEDICINE_IMAGE,
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
};

export default function MedicineImage({
  src,
  alt,
  width,
  height,
  className,
  fill,
}: MedicineImageProps) {
  const [imgSrc, setImgSrc] = useState(() => resolveMedicineImageSrc(src));
  const external = isExternalMedicineImage(imgSrc);

  if (fill) {
    return (
      <Image
        src={imgSrc}
        alt={alt}
        fill
        unoptimized={external}
        className={className}
        onError={() => setImgSrc(DEFAULT_MEDICINE_IMAGE)}
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
      onError={() => setImgSrc(DEFAULT_MEDICINE_IMAGE)}
    />
  );
}
