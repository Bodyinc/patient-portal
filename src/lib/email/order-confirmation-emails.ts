import "server-only";

import { emailButton, emailLayout, formatAmount } from "./layout";

function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

function nextStepCopy(requiresConsultation: boolean): string {
  return requiresConsultation
    ? "A licensed provider will review your intake and, once approved, your prescription moves to the pharmacy. We'll email you at every step."
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
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const heading = params.isRefill ? "Your refill is confirmed" : "Your order is confirmed";

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#777777;">${label}</td><td style="padding:6px 0;text-align:right;font-weight:bold;color:#1a1a1a;">${value}</td></tr>`;

  const details = [
    detailRow("Order", params.orderNumber),
    detailRow("Medication", params.medicineName),
    params.variantName ? detailRow("Dosage", params.variantName) : "",
    params.planName ? detailRow("Plan", params.planName) : "",
    detailRow("Total paid", amount),
  ].join("");

  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>Thanks — we've received your payment and your order is confirmed.</p>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;font-size:14px;border-top:1px solid #eeeeee;border-bottom:1px solid #eeeeee;">${details}</table>`,
    `<p>${nextStepCopy(params.requiresConsultation)}</p>`,
    emailButton("Track my order", params.myMedsUrl),
    `<p style="color:#999999;font-size:12px;">Your itemised invoice is sent separately by our payment processor, Stripe.</p>`,
  ].join("");

  return {
    subject: `${heading} — ${params.medicineName} (${params.orderNumber})`,
    html: emailLayout(heading, body),
  };
}
