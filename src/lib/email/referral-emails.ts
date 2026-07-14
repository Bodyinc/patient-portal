import "server-only";

import { emailButton, emailLayout, formatAmount } from "./layout";

export function referralRewardEmail(params: { fullName: string | null; amountCents: number }): {
  subject: string;
  html: string;
} {
  const amount = formatAmount(params.amountCents, "usd");
  const first = (params.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const body = [
    `<p>Hi ${first},</p>`,
    `<p>Someone you referred just started their Body Inc treatment — thank you for spreading the word!</p>`,
    `<p style="font-size:24px;font-weight:bold;color:#1a1a1a;margin:16px 0;">${amount} credit added</p>`,
    `<p>The credit is on your account and applies automatically to your next bill. Keep sharing your link to earn more.</p>`,
    emailButton(
      "View my billing",
      `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/billing`,
    ),
  ].join("");
  return {
    subject: `You earned a ${amount} referral credit`,
    html: emailLayout("Referral reward earned", body),
  };
}
