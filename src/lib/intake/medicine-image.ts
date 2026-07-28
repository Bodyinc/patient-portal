export const DEFAULT_MEDICINE_IMAGE = "/medicine-vial-default.png";

export function resolveMedicineImageSrc(imageUrl: string | null | undefined): string {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return DEFAULT_MEDICINE_IMAGE;
  return trimmed;
}

/** DB image only — null when missing or when the syrup placeholder would be used. */
export function getDbMedicineImageSrc(imageUrl: string | null | undefined): string | null {
  const trimmed = imageUrl?.trim();
  if (!trimmed || trimmed === DEFAULT_MEDICINE_IMAGE) return null;
  return trimmed;
}

export function isExternalMedicineImage(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}
