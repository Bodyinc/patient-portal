import "server-only";

import { adminAppUrl } from "./recipients";
import { emailButton, emailLayout } from "./layout";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function patientFeedbackAdminEmail(params: {
  message: string;
  pagePath: string | null;
  patientName: string | null;
  patientEmail: string | null;
  intakeSessionId?: string | null;
}): { subject: string; html: string } {
  const name = params.patientName?.trim() || "Anonymous";
  const email = params.patientEmail?.trim() || "not provided";
  const page = params.pagePath?.trim() || "unknown page";
  const reviewUrl = adminAppUrl() ? `${adminAppUrl()}/admin/feedback` : null;
  const sessionUrl =
    params.intakeSessionId && adminAppUrl()
      ? `${adminAppUrl()}/admin/intake-sessions/${params.intakeSessionId}`
      : null;
  const body = [
    `<p>A patient submitted an inquiry from the portal.</p>`,
    `<p><strong>Patient:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>`,
    `<p><strong>Page:</strong> ${escapeHtml(page)}</p>`,
    params.intakeSessionId
      ? `<p><strong>Intake session:</strong> ${escapeHtml(params.intakeSessionId)}</p>`
      : "",
    `<p><strong>Message:</strong></p>`,
    `<p style="white-space:pre-wrap;">${escapeHtml(params.message)}</p>`,
    reviewUrl ? emailButton("Open in admin portal", reviewUrl) : "",
    sessionUrl ? emailButton("Open intake session", sessionUrl) : "",
  ].join("");

  return {
    subject: `[Body Inc] Patient inquiry`,
    html: emailLayout("New patient inquiry", body),
  };
}

export function patientInquiryReplyAdminEmail(params: {
  message: string;
  reply: string;
  patientName: string | null;
  patientEmail: string | null;
}): { subject: string; html: string } {
  const name = params.patientName?.trim() || "Anonymous";
  const email = params.patientEmail?.trim() || "not provided";
  const reviewUrl = adminAppUrl() ? `${adminAppUrl()}/admin/feedback` : null;
  const body = [
    `<p>A patient replied to an inquiry.</p>`,
    `<p><strong>Patient:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>`,
    `<p><strong>Original inquiry:</strong></p>`,
    `<p style="white-space:pre-wrap;">${escapeHtml(params.message)}</p>`,
    `<p><strong>Patient reply:</strong></p>`,
    `<p style="white-space:pre-wrap;">${escapeHtml(params.reply)}</p>`,
    reviewUrl ? emailButton("Open in admin portal", reviewUrl) : "",
  ].join("");

  return {
    subject: `[Body Inc] Patient inquiry reply`,
    html: emailLayout("Patient inquiry reply", body),
  };
}
