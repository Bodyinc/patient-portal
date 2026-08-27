const DEFAULT_SUPPORT_EMAIL = "support@bodyinc.com";

/** Client-safe support inbox for billing help copy. */
export function patientSupportEmail(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()) {
    return process.env.NEXT_PUBLIC_SUPPORT_EMAIL.trim();
  }
  return DEFAULT_SUPPORT_EMAIL;
}
