import "server-only";

import { appUrl } from "@/lib/email/recipients";
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
    `Your clinician changed your medicine to <strong>${m}</strong>. You can pay the difference or decline the change.`,
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

function sevenDayLine(reminder: boolean): string {
  const window = reminder
    ? "If you do neither before the 7 days are up, the change is cancelled, the previous medicine and plan are restored, and you are not charged. Your provider is notified that the change timed out."
    : "You have 7 days. We will email you once more after 24 hours if you have not responded. If you do neither within 7 days, the change is cancelled, the previous medicine and plan are restored, and you are not charged. Your provider is notified that the change timed out.";
  return `<p>${window}</p>`;
}

/** Provider changed the medicine and the new one costs more. */
export function medicineChangePaymentEmail(params: {
  fullName: string | null;
  medicineName: string;
  orderNumber: string;
  amountCents: number;
  currency?: string | null;
  payUrl: string;
  declineUrl: string;
  reminder?: boolean;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency ?? "usd");
  const medicine = escapeHtml(params.medicineName);
  const heading = params.reminder
    ? "Reminder: pay or decline this change"
    : "Pay or decline this change";
  const body = [
    `<p>Hi ${escapeHtml(firstName(params.fullName))},</p>`,
    params.reminder ? `<p>This is a reminder. You still have time to respond.</p>` : "",
    `<p>Your clinician changed your medicine to <strong>${medicine}</strong>. The new medicine costs <strong>${amount}</strong> more.</p>`,
    `<p>Sign in to your patient portal to pay this difference or decline the change. After you sign in, open Dashboard or My Meds. Pay now is on that order. You can decline the change from the same order.</p>`,
    `<p>If you pay, the updated order is sent to the pharmacy automatically.</p>`,
    `<p>If you decline, you are not charged, the pending charge is cancelled, and the order returns to the previous medicine and plan. It goes back under review, and your provider is notified.</p>`,
    sevenDayLine(Boolean(params.reminder)),
    emailChip(`Order ${escapeHtml(params.orderNumber)}`),
    emailButton("Sign in to your portal", `${appUrl()}/auth`),
  ].join("");

  return {
    subject: `${params.reminder ? "Reminder: " : ""}Pay or decline your treatment change — ${params.medicineName}`,
    html: emailLayout(heading, body),
  };
}

/** Provider changed the medicine and nothing extra is due, including a cheaper medicine. */
export function medicineChangeConsentEmail(params: {
  fullName: string | null;
  medicineName: string;
  orderNumber: string;
  creditCents?: number | null;
  approveUrl: string;
  rejectUrl: string;
  reminder?: boolean;
}): { subject: string; html: string } {
  const medicine = escapeHtml(params.medicineName);
  const credit =
    params.creditCents != null && params.creditCents > 0
      ? formatAmount(params.creditCents, "usd")
      : null;
  const heading = params.reminder
    ? "Reminder: approve or reject this change"
    : "Approve or reject this change";
  const body = [
    `<p>Hi ${escapeHtml(firstName(params.fullName))},</p>`,
    params.reminder ? `<p>This is a reminder. You still have time to respond.</p>` : "",
    `<p>Your clinician changed your medicine to <strong>${medicine}</strong>. Nothing extra is due. There is no payment.</p>`,
    credit
      ? `<p>If you approve, a credit of <strong>${credit}</strong> is applied to your next bill.</p>`
      : "",
    `<p>Sign in to your patient portal to approve or reject this change. After you sign in, open Dashboard or My Meds. Approve and Reject are on that order. There is no payment.</p>`,
    `<p>If you approve, the updated order is sent to the pharmacy automatically.</p>`,
    `<p>If you reject, nothing is charged, no credit is applied, and the order returns to the previous medicine and plan. It goes back under review, and your provider is notified.</p>`,
    sevenDayLine(Boolean(params.reminder)),
    emailChip(`Order ${escapeHtml(params.orderNumber)}`),
    emailButton("Sign in to your portal", `${appUrl()}/auth`),
  ].join("");

  return {
    subject: `${params.reminder ? "Reminder: " : ""}Approve or reject your treatment change — ${params.medicineName}`,
    html: emailLayout(heading, body),
  };
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

  if (
    params.status === "awaiting_additional_payment" &&
    params.amountCents != null &&
    params.amountCents > 0
  ) {
    return medicineChangePaymentEmail({
      fullName: params.fullName,
      medicineName: params.medicineName,
      orderNumber: params.orderNumber,
      amountCents: params.amountCents,
      currency: params.currency,
      payUrl: params.ctaUrl,
      declineUrl: params.ctaUrl.replace(/\/pay\/?$/, "?action=decline"),
    });
  }

  const ctaLabel = params.status === "provider_assigned" ? "Open consultations" : "View my meds";

  const orderDetails =
    params.status === "dispatched"
      ? dispatchedDetailsBlock(params.orderNumber, params.trackingNumber)
      : emailChip(`Order ${params.orderNumber}`);

  let statusBody = bodyFn(params.medicineName);
  if (params.status === "approved" && params.consultationApproved) {
    statusBody = `Your <strong>${params.medicineName}</strong> consultation is approved, and your prescription has been approved.`;
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
