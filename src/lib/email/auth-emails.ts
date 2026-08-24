import "server-only";

import { EMAIL_THEME, emailLayout } from "./layout";

export function verificationCodeEmail(params: { code: string; fullName?: string | null }): {
  subject: string;
  html: string;
} {
  const first = (params.fullName ?? "").trim().split(/\s+/)[0] || "";
  const hello = first ? `Hello ${first},` : "Hello,";
  const spaced = params.code.trim().split("").join(" ");

  const body = [
    `<p>${hello}</p>`,
    `<p>Enter the verification code below to securely log in. This code helps us confirm your identity and protect your account.</p>`,
    `<p style="margin:28px 0;text-align:center;font-size:28px;font-weight:600;letter-spacing:0.28em;line-height:1.4;color:${EMAIL_THEME.navy};">${spaced}</p>`,
    `<p>This code will expire in <strong>10 minutes</strong>.</p>`,
    `<p style="color:${EMAIL_THEME.navyFaint};font-size:12px;">If you didn't request this code, you can ignore this email.</p>`,
  ].join("");

  return {
    subject: "Your Body Inc verification code",
    html: emailLayout("Verification Code", body),
  };
}
