/** Figma onboarding theme tokens — visual only. */
export const ONBOARDING = {
  navy: "#152A51",
  navyMuted: "rgba(21, 42, 81, 0.8)",
  navyPlaceholder: "rgba(21, 42, 81, 0.4)",
  cta: "#E3E084",
  ctaHover: "#D9D674",
  inputBg: "#E8EEED",
  inputRadius: "14px",
  inputHeight: "45px",
  gauge: "#6A9B9C",
  check: "#6A9B9C",
  /** Figma product shot surface behind medicine images */
  medicineImageBg: "#E8EEED",
  /** Medication card solid badge accents (Figma) */
  badgeTerracotta: "#C47A5A",
  badgeOrchid: "#C47A9B",
  /** Selected radio on medication cards */
  selectTeal: "#6A9B9C",
} as const;

/** Solid highlight badge colors — cycle by medicine index when multiple cards highlight. */
export const MEDICATION_BADGE_ACCENTS = [
  ONBOARDING.badgeTerracotta,
  ONBOARDING.badgeOrchid,
] as const;

/** Unified rounded frame with Figma catalog surface. */
export const medicineImageFrameClass = "relative overflow-hidden rounded-[20px] bg-[#E8EEED]";

/** Figma choose-medication / shop catalog image well. */
export const MEDICATION_CARD_IMAGE_ASPECT = "386 / 359";

/** @deprecated Use MEDICATION_CARD_IMAGE_ASPECT */
export const MEDICATION_IMAGE_ASPECT = MEDICATION_CARD_IMAGE_ASPECT;

/** @deprecated Use MEDICATION_CARD_IMAGE_ASPECT */
export const SHOP_CATALOG_IMAGE_ASPECT = MEDICATION_CARD_IMAGE_ASPECT;

/** @deprecated Slot is now a fixed 133×200 height-fill frame in MedicineProductImage */
export const medicationImageInsetClass = "absolute inset-x-[10%] top-[4%] bottom-[1%]";

/** @deprecated Slot is now a fixed 133×200 height-fill frame in MedicineProductImage */
export const shopCatalogImageInsetClass = "absolute inset-x-[14%] top-[6%] bottom-0";

/** Full vial visible inside the fixed 133×200 slot. */
export const medicineImageFitClass = "object-contain object-bottom mix-blend-normal";

/** Shared label / control classes for Figma-styled form fields. */
export const fieldLabelClass = "text-[14px] font-normal leading-none text-[#152A51]";

export const fieldControlClass =
  "h-[45px] rounded-[14px] border-0 bg-[#E8EEED] px-4 text-[14px] font-normal leading-none text-[#152A51] shadow-none " +
  "placeholder:text-[#152A51]/40 data-[placeholder]:text-[#152A51]/40 " +
  "focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:outline-none";

export const fieldTextareaClass =
  "min-h-[96px] rounded-[14px] border-0 bg-[#E8EEED] px-4 py-3 text-[14px] font-normal text-[#152A51] shadow-none " +
  "placeholder:text-[#152A51]/40 resize-none " +
  "focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:outline-none";
