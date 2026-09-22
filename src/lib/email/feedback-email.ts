import "server-only";

import { adminAppUrl } from "./recipients";
import { emailButton, emailLayout, emailSoftPanel } from "./layout";
import { feedbackStatusLabel } from "@/lib/feedback-status";

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

export function patientInquiryUpdateEmail(params: {
  fullName: string | null;
  status: string;
  originalMessage: string;
  adminNote: string | null;
  inquiriesUrl: string;
}): { subject: string; html: string } {
  const first = (params.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const status = params.status;
  const copy: Record<string, { subject: string; heading: string; intro: string }> = {
    needs_info: {
      subject: "A quick follow-up on your inquiry",
      heading: "We need a little more from you",
      intro:
        "We have an update on your inquiry — we need a little more information from you before we can continue.",
    },
    awaiting_confirmation: {
      subject: "Please check if this solves your inquiry",
      heading: "Please confirm this inquiry",
      intro:
        "We've sent a reply on your inquiry. Please take a look and let us know if that solves it. If we don't hear back in 3 days, we'll mark it as resolved.",
    },
    resolved: {
      subject: "Your inquiry has been resolved",
      heading: "Inquiry resolved",
      intro: "Good news — we've looked into your inquiry and it's been resolved.",
    },
    in_progress: {
      subject: "We're looking into your inquiry",
      heading: "We're looking into it",
      intro: "Just a quick note that we're looking into your inquiry.",
    },
    closed: {
      subject: "Update on your inquiry",
      heading: "Inquiry closed",
      intro:
        "We've closed this inquiry. If anything else comes up, you can send a new one from your portal.",
    },
    open: {
      subject: "Update on your inquiry",
      heading: "Inquiry update",
      intro: "There's an update on your inquiry.",
    },
  };
  const picked =
    copy[status] ??
    ({
      subject: "Update on your inquiry",
      heading: "Inquiry update",
      intro: `Your inquiry is now ${feedbackStatusLabel(status).toLowerCase()}.`,
    } as const);

  const original = params.originalMessage.trim();
  const note = params.adminNote?.trim() || "";
  const body = [
    `<p>Hi ${first},</p>`,
    `<p>${picked.intro}</p>`,
    original
      ? emailSoftPanel(
          `<p style="margin:0 0 8px;"><strong>Your message:</strong></p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(original)}</p>`,
        )
      : "",
    note
      ? emailSoftPanel(
          `<p style="margin:0 0 8px;"><strong>From the Body Inc team:</strong></p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(note)}</p>`,
        )
      : "",
    emailButton("View your inquiries", params.inquiriesUrl),
  ].join("");

  return {
    subject: picked.subject,
    html: emailLayout(picked.heading, body),
  };
}
