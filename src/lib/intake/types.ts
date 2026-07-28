export type IntakeActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  icon: string | null;
  /** Category image URL from DB (`icon` if URL, else first linked medicine `image_url`). */
  imageSrc: string | null;
};

export type IntakeVariantOption = {
  id: string;
  name: string;
  fromPriceCents: number | null;
};

export type MedicineDto = {
  id: string;
  name: string;
  tag: string;
  description: string;
  detailDescription: string;
  importantInfo: string[];
  notice: string;
  imageSrc: string | null;
  fromPriceCents: number | null;
  // Empty when the medicine has no variants (buy the medicine directly).
  variants: IntakeVariantOption[];
  requiresQuestionnaire: boolean;
};

export type QuestionType = "text" | "number" | "boolean" | "single_select" | "multi_select";

export type QuestionOptionDto = {
  id: string;
  label: string;
};

export type QuestionDto = {
  id: string;
  text: string;
  description: string | null;
  questionType: QuestionType;
  isRequired: boolean;
  options: QuestionOptionDto[];
};

export type QuestionnaireDto = {
  id: string;
  title: string;
  questions: QuestionDto[];
};

export type PackageDto = {
  id: string;
  name: string;
  durationMonths: number;
  originalPrice: number;
  price: number;
  isMostPopular: boolean;
  features: string[];
  clinicalNote: string | null;
};

export type EligibilityResultDto = {
  result: "eligible" | "ineligible" | "needs_review";
  reason: string | null;
};

export type MedicinesForCategoryDto = {
  medicines: MedicineDto[];
  categoryEligible: boolean;
  ineligibleReason: string | null;
};

export type IntakeSummaryDto = {
  sessionId: string;
  goalSlug: string | null;
  goalName: string | null;
  stateCode: string | null;
  sex: string | null;
  dob: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  streetAddress: string | null;
  apartment: string | null;
  city: string | null;
  postalCode: string | null;
  billingSameAsShipping: boolean;
  billingStreetAddress: string | null;
  billingApartment: string | null;
  billingCity: string | null;
  billingStateCode: string | null;
  billingPostalCode: string | null;
  smsConsent: boolean;
  marketingConsent: boolean;
  medicineId: string | null;
  medicineName: string | null;
  requiresQuestionnaire: boolean;
  selectedPackageId: string | null;
  packageName: string | null;
  variantName: string | null;
  packageDurationMonths: number | null;
  packagePrice: number | null;
  eligibilityResult: string | null;
  status: string;
};

export type QuestionnaireAnswerValue = {
  optionIds?: string[];
  text?: string;
  number?: number | null;
  boolean?: boolean | null;
};

export type QuestionnaireResponseInput = {
  questionId: string;
  optionIds?: string[];
  answerText?: string | null;
  answerNumber?: number | null;
  answerBoolean?: boolean | null;
};
