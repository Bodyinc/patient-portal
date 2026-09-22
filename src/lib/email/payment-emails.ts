import "server-only";

import { EMAIL_THEME, emailLayout, emailSoftPanel, formatAmount } from "./layout";

export function refundNotificationEmail(params: {
  amountCents: number;
  currency: string;
  cardLast4?: string | null;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const destination = params.cardLast4
    ? `your card ending in ${params.cardLast4}`
    : "your original payment method";
  const body = [
    `<p>We've issued a refund to ${destination}:</p>`,
    emailSoftPanel(
      `<p style="margin:0;font-size:24px;font-weight:600;color:${EMAIL_THEME.navy};">${amount}</p>`,
    ),
    `<p>Depending on your bank, it can take 5–10 business days for the refund to appear on your statement.</p>`,
  ].join("");
  return {
    subject: `Your Body Inc refund of ${amount}`,
    html: emailLayout("Refund issued", body),
  };
}
