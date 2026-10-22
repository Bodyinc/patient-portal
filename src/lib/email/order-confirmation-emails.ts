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

export type OrderConfirmationLine = {
  name: string;
  detail: string | null;
  amountCents: number | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function orderConfirmedEmail(params: {
  fullName: string | null;
  medicineName: string;
  variantName?: string | null;
  planName?: string | null;
  lines?: OrderConfirmationLine[];
  orderNumber: string;
  amountCents: number;
  currency: string;
  requiresConsultation: boolean;
  isRefill: boolean;
  myMedsUrl: string;
  consultationsUrl?: string;
  invoiceUrl?: string | null;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const heading = params.isRefill ? "Payment and refill confirmed" : "Payment and order confirmed";
  const consultationsUrl = params.consultationsUrl ?? "https://patient.bodyinc.com/consultations";
  const lines = params.lines ?? [];
  const subjectMedicine = lines.length > 1 ? `${lines.length} medications` : params.medicineName;

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:${EMAIL_THEME.navyFaint};">${label}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:${EMAIL_THEME.navy};">${value}</td></tr>`;

  const lineRows =
    lines.length > 1
      ? lines
          .map((line) => {
            const detail = line.detail
              ? `<div style="font-weight:500;color:${EMAIL_THEME.navyFaint};font-size:12px;">${escapeHtml(line.detail)}</div>`
              : "";
            const lineAmount =
              line.amountCents != null ? formatAmount(line.amountCents, params.currency) : "";
            return `<tr><td style="padding:8px 0;color:${EMAIL_THEME.navy};font-weight:600;">${escapeHtml(line.name)}${detail}</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${EMAIL_THEME.navy};white-space:nowrap;">${lineAmount}</td></tr>`;
          })
          .join("")
      : [
          detailRow("Medication", params.medicineName),
          params.variantName ? detailRow("Dosage", params.variantName) : "",
          params.planName ? detailRow("Plan", params.planName) : "",
        ].join("");

  const details = [
    detailRow("Order", params.orderNumber),
    lineRows,
    detailRow("Amount paid", amount),
  ].join("");

  const invoiceLink = params.invoiceUrl
    ? `<p><a href="${params.invoiceUrl}" style="color:${EMAIL_THEME.navy};font-weight:600;text-decoration:underline;">View invoice</a></p>`
    : "";

  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>We've received your payment of <strong>${amount}</strong>. This email is your payment receipt and order confirmation.</p>`,
    lines.length > 1
      ? `<p>This is one order. The treatments below are included together, and one consultation covers all of them.</p>`
      : "",
    emailSoftPanel(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${details}</table>`,
    ),
    invoiceLink,
    `<p>${nextStepCopy(params.requiresConsultation)}</p>`,
    emailButton("Track my order", params.myMedsUrl),
    emailButton("Start consultation", consultationsUrl),
  ].join("");

  return {
    subject: `${heading} — ${subjectMedicine} (${params.orderNumber})`,
    html: emailLayout(heading, body),
  };
}
