import "server-only";

import { patientStatusLabel } from "@/lib/orders/status";
import { emailButton, emailChip, emailLayout } from "./layout";

function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

const STATUS_BODY: Record<string, (medicineName: string) => string> = {
  provider_assigned: (m) =>
    `A licensed practitioner has been assigned to review your <strong>${m}</strong> request.`,
  pending_review: (m) =>
    `Your <strong>${m}</strong> prescription is currently under review by your care team.`,
  awaiting_additional_payment: (m) =>
    `An additional payment is required to continue your <strong>${m}</strong> prescription. Please complete payment to avoid delays.`,
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

export function orderStatusEmail(params: {
  fullName: string | null;
  medicineName: string;
  status: string;
  orderNumber: string;
  ctaUrl: string;
  trackingNumber?: string | null;
}): { subject: string; html: string } | null {
  const label = patientStatusLabel(params.status);
  const bodyFn = STATUS_BODY[params.status];
  if (!bodyFn) return null;

  const ctaLabel =
    params.status === "awaiting_additional_payment" ? "Complete payment" : "View my meds";

  const tracking =
    params.status === "dispatched" && params.trackingNumber
      ? `<p><strong>Tracking:</strong> ${params.trackingNumber}</p>`
      : "";

  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>${bodyFn(params.medicineName)}</p>`,
    emailChip(`Order ${params.orderNumber}`),
    tracking,
    emailButton(ctaLabel, params.ctaUrl),
  ].join("");

  return {
    subject: `${label} — ${params.medicineName}`,
    html: emailLayout(label, body),
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
