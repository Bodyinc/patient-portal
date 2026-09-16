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

/** Serve a smaller WebP/AVIF variant from Supabase instead of the full-size upload. */
export function toResizedPublicImageSrc(
  src: string,
  options: { width: number; quality?: number } = { width: 640 },
): string {
  try {
    const url = new URL(src);
    if (!url.hostname.endsWith(".supabase.co")) return src;
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) return src;
    const objectPath = url.pathname.slice(index + marker.length);
    url.pathname = `/storage/v1/render/image/public/${objectPath}`;
    url.search = "";
    url.searchParams.set("width", String(options.width));
    url.searchParams.set("quality", String(options.quality ?? 70));
    url.searchParams.set("resize", "cover");
    return url.toString();
  } catch {
    return src;
  }
}
