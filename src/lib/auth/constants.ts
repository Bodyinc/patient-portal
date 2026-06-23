export const PORTAL_ROLE = "patient" as const;

export type AppRole = "patient" | "provider" | "admin";

/** Routes that require an authenticated session */
export const PROTECTED_PATHS = ["/dashboard"];

/**
 * Guest routes that redirect to /dashboard when already authenticated.
 * Excludes /reset-password and /auth/callback (recovery/code exchange flows).
 */
export const GUEST_REDIRECT_PATHS = [
  "/auth",
  "/signup",
  "/forgot-password",
  "/otp-login",
  "/verify-otp",
];

/** Routes that must never auto-redirect authenticated users away */
export const AUTH_FLOW_PATHS = ["/reset-password", "/auth/callback", "/auth/signout"];

export const OTP_LENGTH = 6;

export function wrongPortalMessage(role: string) {
  return `This email is registered on the ${role} portal. Please sign in at ${role}.bodyinc.com — you cannot use the patient portal.`;
}

export const WRONG_PORTAL_GENERIC_MESSAGE =
  "This account cannot access the patient portal. Please sign in at the correct BodyInc portal.";

export function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isGuestRedirectPath(pathname: string) {
  if (AUTH_FLOW_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return false;
  }
  return GUEST_REDIRECT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
