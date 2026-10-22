import "server-only";

import { patientStatusLabel } from "@/lib/orders/status";
import { emailButton, emailChip, emailLayout, emailSoftPanel, formatAmount } from "./layout";

function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

const STATUS_BODY: Record<string, (medicineName: string) => string> = {
  provider_assigned: (m) =>
    `A licensed practitioner has been assigned to your <strong>${m}</strong> request and is ready to consult. Your prescription is now under review.`,
  awaiting_additional_payment: (m) =>
    `Your clinician updated your <strong>${m}</strong> treatment. An additional payment is required before your prescription can continue. Please complete payment to avoid delays.`,
  approved: (m) => `Your <strong>${m}</strong> prescription has been approved.`,
  prescribed: (m) =>
    `Your <strong>${m}</strong> prescription is ready and moving toward fulfillment.`,
  sent_to_pharmacy: (m) => `Your <strong>${m}</strong> order has been sent to the pharmacy.`,
  dispatched: (m) => `Your <strong>${m}</strong> medication has been dispatched.`,
  delivered: (m) => `Your <strong>${m}</strong> medication has been marked as delivered.`,
  rejected: (m) =>
    `Your <strong>${m}</strong> request was not approved. If a refund applies, it will be processed separately.`,
  cancelled: (m) => `Your <strong>${m}</strong> medication request was cancelled.`,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trackingLine(trackingNumber: string): string {
  const trackingValue = trackingNumber.trim();
  const trackingUrl = /^https?:\/\//i.test(trackingValue) ? trackingValue : null;
  const safeValue = escapeHtml(trackingValue);
  if (trackingUrl) {
    return `<p style="margin:0;"><strong>Tracking ID:</strong> <a href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener noreferrer">${safeValue}</a></p>`;
  }
  return `<p style="margin:0;"><strong>Tracking ID:</strong> ${safeValue}</p>`;
}

function dispatchedDetailsBlock(orderNumber: string, trackingNumber?: string | null): string {
  const trackingValue = trackingNumber?.trim();

  const lines = [
    `<p style="margin:0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(orderNumber)}</p>`,
  ];

  if (trackingValue) lines.push(trackingLine(trackingValue));

  return emailSoftPanel(lines.join(""));
}

export function orderStatusEmail(params: {
  fullName: string | null;
  medicineName: string;
  status: string;
  orderNumber: string;
  ctaUrl: string;
  trackingNumber?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  consultationApproved?: boolean;
}): { subject: string; html: string } | null {
  const bodyFn = STATUS_BODY[params.status];
  if (!bodyFn) return null;

  const label =
    params.status === "provider_assigned"
      ? "Practitioner assigned — prescription under review"
      : patientStatusLabel(params.status);

  const ctaLabel =
    params.status === "awaiting_additional_payment"
      ? "Complete payment"
      : params.status === "provider_assigned"
        ? "Open consultations"
        : "View my meds";

  const orderDetails =
    params.status === "dispatched"
      ? dispatchedDetailsBlock(params.orderNumber, params.trackingNumber)
      : emailChip(`Order ${params.orderNumber}`);

  let statusBody = bodyFn(params.medicineName);
  if (params.status === "approved" && params.consultationApproved) {
    statusBody = `Your <strong>${params.medicineName}</strong> consultation is approved, and your prescription has been approved.`;
  }
  if (
    params.status === "awaiting_additional_payment" &&
    params.amountCents != null &&
    params.amountCents > 0
  ) {
    const amount = formatAmount(params.amountCents, params.currency ?? "usd");
    statusBody = `Your clinician updated your <strong>${params.medicineName}</strong> treatment. An additional payment of <strong>${amount}</strong> is required before your prescription can continue. Please complete payment to avoid delays.`;
  }

  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>${statusBody}</p>`,
    orderDetails,
    emailButton(ctaLabel, params.ctaUrl),
  ].join("");

  return {
    subject: `${label} — ${params.medicineName}`,
    html: emailLayout(label, body),
  };
}

export function trackingIdEmail(params: {
  fullName: string | null;
  medicineName: string;
  orderNumber: string;
  trackingNumber: string;
  ctaUrl: string;
}): { subject: string; html: string } {
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>A tracking ID is ready for your <strong>${params.medicineName}</strong> order.</p>`,
    emailSoftPanel(
      [
        `<p style="margin:0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(params.orderNumber)}</p>`,
        trackingLine(params.trackingNumber),
      ].join(""),
    ),
    emailButton("View my meds", params.ctaUrl),
  ].join("");

  return {
    subject: `Tracking ID for your ${params.medicineName} order`,
    html: emailLayout("Your tracking ID", body),
  };
}

export function providerCaseAssignedEmail(params: {
  providerName: string | null;
  medicineName: string;
  orderNumber: string;
  patientName: string | null;
  caseUrl: string | null;
}): { subject: string; html: string } {
  const body = [
    `<p>Hi ${firstName(params.providerName)},</p>`,
    `<p>A new case has been assigned to you.</p>`,
    `<p><strong>Medication:</strong> ${params.medicineName}</p>`,
    `<p><strong>Patient:</strong> ${params.patientName ?? "—"}</p>`,
    `<p><strong>Order:</strong> ${params.orderNumber}</p>`,
    params.caseUrl ? emailButton("Open case", params.caseUrl) : "",
  ].join("");
  return {
    subject: `[Body Inc] New case assigned — ${params.orderNumber}`,
    html: emailLayout("New case assigned", body),
  };
}
