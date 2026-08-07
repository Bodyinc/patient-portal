import { z } from "zod";

export const MIN_SIGNUP_AGE = 18;
export const MAX_SIGNUP_AGE = 120;

const DOB_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** Default dial code shown on onboarding (US/CA). */
export const DEFAULT_PHONE_COUNTRY_CODE = "+1";

/** Supported dial codes and expected national number length (digits only). */
export const PHONE_COUNTRY_CODES = [{ code: "+1", label: "US +1", nationalLength: 10 }] as const;

export type PhoneCountryCode = (typeof PHONE_COUNTRY_CODES)[number]["code"];

export function phoneNationalLength(countryCode: string): number {
  return PHONE_COUNTRY_CODES.find((entry) => entry.code === countryCode)?.nationalLength ?? 15;
}

/** Strip non-digits and cap to the expected national length for the dial code. */
export function digitsOnlyPhone(value: string, countryCode: string): string {
  return value.replace(/\D/g, "").slice(0, phoneNationalLength(countryCode));
}

export function isValidNationalPhone(phone: string, countryCode: string): boolean {
  const length = phoneNationalLength(countryCode);
  return new RegExp(`^\\d{${length}}$`).test(phone);
}

export function ageFromDob(dob: string): number | null {
  if (!DOB_FORMAT.test(dob)) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(birth.getTime()) ||
    birth.getUTCFullYear() !== y ||
    birth.getUTCMonth() !== m - 1 ||
    birth.getUTCDate() !== d
  ) {
    return null;
  }
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const monthDiff = now.getUTCMonth() - (m - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d)) age--;
  return age;
}

export function isValidDob(dob: string): boolean {
  const age = ageFromDob(dob);
  return age !== null && age >= MIN_SIGNUP_AGE && age <= MAX_SIGNUP_AGE;
}

// Distinct messages: a malformed or implausibly old date ("valid date of birth") is not the
// same problem as being under 18 ("at least 18"), so an age like 226 (year 1800) no longer
// reports "You must be at least 18 years old".
function refineDob(v: string, ctx: z.RefinementCtx) {
  const age = ageFromDob(v);
  // null = malformed; <0 = future date; >max = implausibly old. All are "not a valid DOB",
  // distinct from a real-but-under-18 date.
  if (age === null || age < 0 || age > MAX_SIGNUP_AGE) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date of birth" });
    return;
  }
  if (age < MIN_SIGNUP_AGE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `You must be at least ${MIN_SIGNUP_AGE} years old`,
    });
  }
}

export const DOB_SCHEMA = z.string().trim().superRefine(refineDob);

// Empty allowed; when present it must be a real, in-range date of birth.
export const OPTIONAL_DOB_SCHEMA = z
  .string()
  .trim()
  .optional()
  .superRefine((v, ctx) => {
    if (!v) return;
    refineDob(v, ctx);
  });

export const PHONE_COUNTRY_CODE_SCHEMA = z
  .string()
  .trim()
  .refine(
    (value) => PHONE_COUNTRY_CODES.some((entry) => entry.code === value),
    "Select a country code",
  );

/** National number only (no dial code). Defaults to US/CA 10-digit length. */
export const PHONE_SCHEMA = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Enter a valid 10-digit phone number");

// Empty allowed; when present it must be digits at a plausible national length.
export const OPTIONAL_PHONE_SCHEMA = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^\d{7,15}$/.test(v), "Enter a valid phone number");

export const OPTIONAL_PHONE_COUNTRY_CODE_SCHEMA = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine(
    (value) => !value || PHONE_COUNTRY_CODES.some((entry) => entry.code === value),
    "Select a country code",
  );
