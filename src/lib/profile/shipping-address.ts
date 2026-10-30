import { isUsStateCode } from "@/lib/profile/us-states";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  digitsOnlyPhone,
  digitsOnlyZip,
  isValidNationalPhone,
} from "@/lib/validation";

export type OrderIdentity = {
  fullName?: string | null;
  phone?: string | null;
  stateCode?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

/**
 * Checkout used to succeed with a blank state because the browser kept a local copy
 * and the server never checked again. Provider assignment needs these details.
 */
export function missingOrderDetailsMessage(
  input: OrderIdentity,
  where: "profile" | "intake",
): string | null {
  let issue: string | null = null;
  if (!input.fullName?.trim()) {
    issue = "Enter your full name.";
  } else if (!isUsStateCode(input.stateCode)) {
    issue = "Select your state. We need it to match you with a licensed provider.";
  } else if (!input.streetAddress?.trim()) {
    issue = "Enter your street address.";
  } else if (!input.city?.trim()) {
    issue = "Enter your city.";
  } else if (!digitsOnlyZip(input.postalCode ?? "")) {
    issue = "Enter your ZIP code.";
  } else if (
    !isValidNationalPhone(
      digitsOnlyPhone(input.phone ?? "", DEFAULT_PHONE_COUNTRY_CODE),
      DEFAULT_PHONE_COUNTRY_CODE,
    )
  ) {
    issue = "Enter a valid 10-digit phone number.";
  }

  if (!issue) return null;
  if (where === "profile") {
    return `${issue} Update it in your profile, then try again.`;
  }
  return `${issue} Go back and complete it, then try again.`;
}
