import "server-only";

import { EMAIL_THEME, emailButton, emailLayout, emailSoftPanel, formatAmount } from "./layout";

function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

function nextStepCopy(requiresConsultation: boolean): string {
  return requiresConsultation
    ? "A licensed practitioner will be assigned next. We'll email you when they are ready to consult."
    : "Your prescription has been issued and your order is moving to fulfillment. We'll email you when it ships.";
}

export function orderConfirmedEmail(params: {
  fullName: string | null;
  medicineName: string;
  variantName?: string | null;
  planName?: string | null;
  orderNumber: string;
  amountCents: number;
  currency: string;
  requiresConsultation: boolean;
  isRefill: boolean;
  myMedsUrl: string;
  invoiceUrl?: string | null;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const heading = params.isRefill ? "Payment and refill confirmed" : "Payment and order confirmed";

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:${EMAIL_THEME.navyFaint};">${label}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:${EMAIL_THEME.navy};">${value}</td></tr>`;

  const details = [
    detailRow("Order", params.orderNumber),
    detailRow("Medication", params.medicineName),
    params.variantName ? detailRow("Dosage", params.variantName) : "",
    params.planName ? detailRow("Plan", params.planName) : "",
    detailRow("Amount paid", amount),
  ].join("");

  const invoiceLink = params.invoiceUrl
    ? `<p><a href="${params.invoiceUrl}" style="color:${EMAIL_THEME.navy};font-weight:600;text-decoration:underline;">View invoice</a></p>`
    : "";

  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>We've received your payment of <strong>${amount}</strong>. This email is your payment receipt and order confirmation.</p>`,
    emailSoftPanel(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${details}</table>`,
    ),
    invoiceLink,
    `<p>${nextStepCopy(params.requiresConsultation)}</p>`,
    emailButton("Track my order", params.myMedsUrl),
  ].join("");

  return {
    subject: `${heading} — ${params.medicineName} (${params.orderNumber})`,
    html: emailLayout(heading, body),
  };
}
