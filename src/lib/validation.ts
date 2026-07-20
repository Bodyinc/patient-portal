import { z } from "zod";

export const MIN_SIGNUP_AGE = 18;
export const MAX_SIGNUP_AGE = 120;

const DOB_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
// Digits, spaces, parens, plus, hyphens; 7–20 chars. Mirrors the access-hub provider form so
// phone validation is consistent across both apps.
const PHONE_FORMAT = /^[\d\s()+-]{7,20}$/;

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

export const PHONE_SCHEMA = z.string().trim().regex(PHONE_FORMAT, "Enter a valid phone number");

// Empty allowed; when present it must match the phone format.
export const OPTIONAL_PHONE_SCHEMA = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || PHONE_FORMAT.test(v), "Enter a valid phone number");
