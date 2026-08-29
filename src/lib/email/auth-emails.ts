import "server-only";

import { EMAIL_THEME, emailButton, emailLayout, emailSoftPanel } from "./layout";

export type VerificationEmailPurpose = "login" | "change_email";

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
