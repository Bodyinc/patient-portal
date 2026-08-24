import "server-only";

import { EMAIL_THEME, emailButton, emailLayout, formatAmount } from "./layout";
import { formatPortalDate } from "@/lib/date-format";

function firstName(fullName: string | null): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

export function incompleteOrderEmail(params: {
  fullName: string | null;
  planName: string | null;
  resumeUrl: string;
}): { subject: string; html: string } {
  const plan = params.planName
    ? `your <strong>${params.planName}</strong> plan`
    : "your treatment plan";
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>You're almost there — ${plan} is saved and waiting. Pick up right where you left off and finish your checkout in under a minute.</p>`,
    emailButton("Finish my order", params.resumeUrl),
    `<p style="color:${EMAIL_THEME.navyFaint};font-size:13px;">Your progress is saved for 7 days. If you didn't start an order with Body Inc, you can ignore this email.</p>`,
  ].join("");
  return {
    subject: "Your Body Inc order is almost complete",
    html: emailLayout("Finish setting up your treatment", body),
  };
}

export function refillReminderEmail(params: {
  fullName: string | null;
  medicineName: string;
  renewalDate: string;
  amountCents: number | null;
  billingUrl: string;
}): { subject: string; html: string } {
  const date = formatPortalDate(params.renewalDate);
  const charge =
    params.amountCents != null
      ? ` and ${formatAmount(params.amountCents, "usd")} will be charged to your card on file`
      : "";
  const body = [
    `<p>Hi ${firstName(params.fullName)},</p>`,
    `<p>Your <strong>${params.medicineName}</strong> refill renews on <strong>${date}</strong>${charge}.</p>`,
    `<p>No action is needed — this is just a heads-up. If your card or shipping details changed, update them before the renewal date.</p>`,
    emailButton("Manage my subscription", params.billingUrl),
  ].join("");
  return {
    subject: `Your ${params.medicineName} refill renews on ${date}`,
    html: emailLayout("Upcoming refill", body),
  };
}
