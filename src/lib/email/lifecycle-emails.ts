import "server-only";

import { emailButton, emailLayout, formatAmount } from "./layout";

function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "the end of your billing period";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function paymentFailedEmail(params: {
  fullName: string | null;
  amountCents: number;
  currency: string;
  description?: string | null;
  billingUrl: string;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>We couldn't process your recent payment of <strong>${amount}</strong>${
      params.description ? ` for <strong>${params.description}</strong>` : ""
    }.</p>`,
    `<p>Please update your card on file so your treatment isn't interrupted.</p>`,
    emailButton("Update billing", params.billingUrl),
  ].join("");
  return {
    subject: `Action needed: payment of ${amount} failed`,
    html: emailLayout("Payment unsuccessful", body),
  };
}

export function paymentFailedAdminEmail(params: {
  patientEmail: string | null;
  amountCents: number;
  currency: string;
  stripeInvoiceId?: string | null;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const body = [
    `<p>A subscription payment failed.</p>`,
    `<p><strong>Amount:</strong> ${amount}</p>`,
    `<p><strong>Patient:</strong> ${params.patientEmail ?? "unknown"}</p>`,
    params.stripeInvoiceId ? `<p><strong>Invoice:</strong> ${params.stripeInvoiceId}</p>` : "",
  ].join("");
  return {
    subject: `[Body Inc] Payment failed — ${amount}`,
    html: emailLayout("Payment failed", body),
  };
}

export function cancellationScheduledEmail(params: {
  fullName: string | null;
  medicineName?: string | null;
  periodEnd: string | null;
  billingUrl: string;
}): { subject: string; html: string } {
  const end = formatDate(params.periodEnd);
  const med = params.medicineName ? ` for <strong>${params.medicineName}</strong>` : "";
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>We've scheduled your subscription${med} to cancel at the end of the current billing period (<strong>${end}</strong>).</p>`,
    `<p>You'll keep access until then. You can manage billing anytime in your portal.</p>`,
    emailButton("View billing", params.billingUrl),
  ].join("");
  return {
    subject: "Your Body Inc subscription cancellation is scheduled",
    html: emailLayout("Cancellation scheduled", body),
  };
}

export function subscriptionEndedEmail(params: {
  fullName: string | null;
  medicineName?: string | null;
  shopUrl: string;
}): { subject: string; html: string } {
  const med = params.medicineName ? ` (<strong>${params.medicineName}</strong>)` : "";
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>Your Body Inc subscription${med} has ended. We're sorry to see you go.</p>`,
    `<p>If you'd like to restart treatment later, you can order again anytime from My Meds or the Shop.</p>`,
    emailButton("Browse treatments", params.shopUrl),
  ].join("");
  return {
    subject: "Your Body Inc subscription has ended",
    html: emailLayout("Subscription ended", body),
  };
}

export function refundRequestReceivedEmail(params: {
  fullName: string | null;
  amountCents: number;
  currency: string;
  billingUrl: string;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>We received your refund request for <strong>${amount}</strong>. Our team will review it and follow up soon.</p>`,
    emailButton("View billing", params.billingUrl),
  ].join("");
  return {
    subject: `We received your refund request (${amount})`,
    html: emailLayout("Refund request received", body),
  };
}

export function refundRequestAdminEmail(params: {
  patientEmail: string;
  patientName: string | null;
  amountCents: number;
  currency: string;
  reason: string | null;
  paymentId: string;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const body = [
    `<p>A patient submitted a refund request.</p>`,
    `<p><strong>Patient:</strong> ${params.patientName ?? "—"} (${params.patientEmail})</p>`,
    `<p><strong>Amount:</strong> ${amount}</p>`,
    `<p><strong>Reason:</strong> ${params.reason?.trim() || "—"}</p>`,
    `<p><strong>Payment ID:</strong> ${params.paymentId}</p>`,
  ].join("");
  return {
    subject: `[Body Inc] Refund request — ${amount}`,
    html: emailLayout("Refund request", body),
  };
}

export function cardUpdatedEmail(params: {
  fullName: string | null;
  cardLabel: string | null;
  billingUrl: string;
}): { subject: string; html: string } {
  const card = params.cardLabel ? ` to <strong>${params.cardLabel}</strong>` : "";
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>Your card on file was updated successfully${card}. Upcoming renewals will use this payment method.</p>`,
    emailButton("View billing", params.billingUrl),
  ].join("");
  return {
    subject: "Your Body Inc card on file was updated",
    html: emailLayout("Card updated", body),
  };
}

export function additionalPaymentReceivedEmail(params: {
  fullName: string | null;
  amountCents: number;
  currency: string;
  myMedsUrl: string;
}): { subject: string; html: string } {
  const amount = formatAmount(params.amountCents, params.currency);
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>We received your additional payment of <strong>${amount}</strong>. Your care team will continue reviewing your prescription.</p>`,
    emailButton("Track my order", params.myMedsUrl),
  ].join("");
  return {
    subject: `Additional payment of ${amount} received`,
    html: emailLayout("Payment received", body),
  };
}
