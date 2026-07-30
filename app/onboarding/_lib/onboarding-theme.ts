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
  medicineImageBg: "#5A778D",
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

/** Unified rounded frame with Figma blue-slate background surface. */
export const medicineImageFrameClass = "relative overflow-hidden rounded-[20px] bg-[#5A778D]";

/** Standardized crop: Top-aligned and zoomed to cut lower body at Figma specification. */
export const medicineImageFitClass = "object-cover object-top scale-110";

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
