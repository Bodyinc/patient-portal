import "server-only";

import { EMAIL_THEME, emailButton, emailLayout, emailSoftPanel } from "./layout";

export type VerificationEmailPurpose = "login" | "change_email";

export const AUTH_MAGICLINK_CLAIM = "auth_magiclink";
export const AUTH_RECOVERY_CLAIM = "auth_recovery";
export const AUTH_PASSWORD_CHANGED_CLAIM = "auth_password_changed";
/** Checkout generateLink must stay silent. The Send Email hook skips when this is present. */
export const AUTH_EMAIL_SKIP_QUERY = "email_skip=1";

export function verificationCodeEmail(params: {
  code: string;
  fullName?: string | null;
  purpose?: VerificationEmailPurpose;
}): {
  subject: string;
  html: string;
} {
  const first = (params.fullName ?? "").trim().split(/\s+/)[0] || "";
  const hello = first ? `Hello ${first},` : "Hello,";
  const spaced = params.code.trim().split("").join(" ");
  const isChange = params.purpose === "change_email";
  const instruction = isChange
    ? "Enter the verification code below to confirm this email address for your Body Inc account."
    : "Enter the verification code below to securely log in. This code helps us confirm your identity and protect your account.";

  const body = [
    `<p>${hello}</p>`,
    `<p>${instruction}</p>`,
    emailSoftPanel(
      `<p style="margin:0;text-align:center;font-size:28px;font-weight:600;letter-spacing:0.28em;line-height:1.4;color:${EMAIL_THEME.navy};">${spaced}</p>`,
      "center",
    ),
    `<p>This code will expire in <strong>10 minutes</strong>.</p>`,
    `<p style="color:${EMAIL_THEME.navyFaint};font-size:12px;">If you didn't request this code, you can ignore this email.</p>`,
  ].join("");

  return {
    subject: isChange ? "Confirm your Body Inc email" : "Your Body Inc verification code",
    html: emailLayout(isChange ? "Confirm your email" : "Verification Code", body),
  };
}

export function passwordResetEmail(params: { resetUrl: string; fullName?: string | null }): {
  subject: string;
  html: string;
} {
  const first = (params.fullName ?? "").trim().split(/\s+/)[0] || "";
  const hello = first ? `Hello ${first},` : "Hello,";
  const body = [
    `<p>${hello}</p>`,
    `<p>We received a request to reset the password for your Body Inc account.</p>`,
    `<p>Click the button below to choose a new password. This link expires in about <strong>1 hour</strong>.</p>`,
    emailButton("Reset password", params.resetUrl),
    `<p style="color:${EMAIL_THEME.navyFaint};font-size:12px;">If you didn't ask to reset your password, you can ignore this email. Your password will stay the same.</p>`,
  ].join("");

  return {
    subject: "Reset your Body Inc password",
    html: emailLayout("Reset your password", body),
  };
}

/** App URL the patient opens. The token is verified in the browser so inbox scanners cannot burn it. */
export function patientPasswordResetUrl(tokenHash: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const origin = configured && configured.length > 0 ? configured : "http://localhost:3000";
  const url = new URL("/reset-password", origin);
  url.searchParams.set("token_hash", tokenHash);
  return url.toString();
}

export function passwordChangedEmail(params: { fullName?: string | null }): {
  subject: string;
  html: string;
} {
  const first = (params.fullName ?? "").trim().split(/\s+/)[0] || "";
  const hello = first ? `Hello ${first},` : "Hello,";
  const body = [
    `<p>${hello}</p>`,
    `<p>This is a confirmation that the password for your Body Inc account was changed.</p>`,
    `<p>You can use your new password the next time you sign in.</p>`,
    `<p style="color:${EMAIL_THEME.navyFaint};font-size:12px;">If you didn't make this change, reset your password and contact support.</p>`,
  ].join("");

  return {
    subject: "Your Body Inc password was changed",
    html: emailLayout("Your password was changed", body),
  };
}
