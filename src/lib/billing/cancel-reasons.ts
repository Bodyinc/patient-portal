export const CANCELLATION_REASONS = [
  { id: "achieved_goals", label: "I've achieved my treatment goals." },
  { id: "no_results", label: "I'm not seeing the expected results." },
  { id: "too_expensive", label: "The plan is too expensive." },
  { id: "pausing", label: "I'm pausing my treatment." },
  { id: "switching_provider", label: "I'm switching to another healthcare provider." },
  { id: "wrong_medication", label: "Medication isn't the right fit for me." },
  { id: "other", label: "Other" },
] as const;

export type CancellationReasonId = (typeof CANCELLATION_REASONS)[number]["id"];

export const CANCELLATION_REASON_IDS = CANCELLATION_REASONS.map((reason) => reason.id);
