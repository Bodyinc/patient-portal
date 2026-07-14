import "server-only";

import { emailLayout, formatAmount } from "./layout";

export function paymentReceiptEmail(params: {
  amountCents: number;
  currency: string;
  description?: string | null;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const rows = [
    `<p>Thank you for your payment. Here's your confirmation:</p>`,
    `<p style="font-size:24px;font-weight:bold;color:#1a1a1a;margin:16px 0;">${amount}</p>`,
    params.description ? `<p><strong>For:</strong> ${params.description}</p>` : "",
    params.invoiceNumber ? `<p><strong>Invoice:</strong> ${params.invoiceNumber}</p>` : "",
    params.invoiceUrl
      ? `<p><a href="${params.invoiceUrl}" style="color:#2563eb;">View your invoice</a></p>`
      : "",
  ];
  return {
    subject: `Your Body Inc payment of ${amount}`,
    html: emailLayout("Payment received", rows.join("")),
  };
}

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
    `<p style="font-size:24px;font-weight:bold;color:#1a1a1a;margin:16px 0;">${amount}</p>`,
    `<p>Depending on your bank, it can take 5–10 business days for the refund to appear on your statement.</p>`,
  ].join("");
  return {
    subject: `Your Body Inc refund of ${amount}`,
    html: emailLayout("Refund issued", body),
  };
}
