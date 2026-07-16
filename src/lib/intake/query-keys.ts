export const intakeQueryKeys = {
  categories: ["intake", "categories"] as const,
  medicines: (categorySlug: string | null) => ["intake", "medicines", categorySlug] as const,
  questionnaire: (medicineId: string | null) => ["intake", "questionnaire", medicineId] as const,
  packages: (medicineId: string | null, variantId?: string | null) =>
    ["intake", "packages", medicineId, variantId ?? null] as const,
  summary: ["intake", "summary"] as const,
};

export const CATALOG_STALE_MS = 5 * 60 * 1000;
export const SUMMARY_STALE_MS = 30 * 1000;
