export const DEFAULT_MEDICINE_IMAGE = "/syrup.svg";

export function resolveMedicineImageSrc(imageUrl: string | null | undefined): string {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return DEFAULT_MEDICINE_IMAGE;
  return trimmed;
}

export function isExternalMedicineImage(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}
