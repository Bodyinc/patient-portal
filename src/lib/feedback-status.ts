export const FEEDBACK_STATUSES = [
  "open",
  "in_progress",
  "needs_info",
  "awaiting_confirmation",
  "resolved",
  "closed",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Received",
  in_progress: "In progress",
  needs_info: "Needs your reply",
  awaiting_confirmation: "Please confirm",
  resolved: "Resolved",
  closed: "Closed",
};

export const FEEDBACK_AUTO_RESOLVE_DAYS = 3;

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function feedbackStatusLabel(status: string): string {
  return isFeedbackStatus(status) ? FEEDBACK_STATUS_LABELS[status] : status;
}

export function canPatientReply(status: string): boolean {
  return status !== "closed";
}

export function canPatientConfirm(status: string): boolean {
  return status === "awaiting_confirmation";
}

export function isStaleAwaitingConfirmation(updatedAt: string, now = Date.now()): boolean {
  const then = new Date(updatedAt).getTime();
  if (Number.isNaN(then)) return false;
  return now - then >= FEEDBACK_AUTO_RESOLVE_DAYS * 24 * 60 * 60 * 1000;
}
