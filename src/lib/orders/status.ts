// Patient-facing labels + timeline for medication orders (medication_requests), mirroring the
// admin/provider status model but with patient-friendly wording.

export const PATIENT_STATUS_LABELS: Record<string, string> = {
  payment_completed: "Payment received",
  provider_assigned: "Practitioner assigned",
  pending_review: "Prescription under review",
  awaiting_additional_payment: "Additional payment required",
  approved: "Prescription approved",
  prescribed: "Prescription ready",
  sent_to_pharmacy: "Sent to pharmacy",
  dispatched: "Medication dispatched",
  delivered: "Delivered",
  rejected: "Rejected & refunded",
  cancelled: "Cancelled",
};

export function patientStatusLabel(status: string): string {
  return PATIENT_STATUS_LABELS[status] ?? status;
}

const STATUS_ORDER: Record<string, number> = {
  payment_completed: 0,
  provider_assigned: 1,
  pending_review: 2,
  awaiting_additional_payment: 3,
  approved: 4,
  prescribed: 5,
  sent_to_pharmacy: 6,
  dispatched: 7,
  delivered: 8,
};

export type TimelineStep = {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming";
  at: string | null;
};

// Builds the ordered tracking steps for one order. Consultation orders pass through review;
// the additional-payment step only appears when it actually happened for this order.
export function buildTimeline(params: {
  requiresConsultation: boolean;
  currentStatus: string;
  occurred: Set<string>;
  atByStatus: Map<string, string>;
}): TimelineStep[] {
  const { requiresConsultation, currentStatus, occurred, atByStatus } = params;

  const stages: string[] = ["payment_completed", "provider_assigned"];
  if (requiresConsultation) stages.push("pending_review");
  if (
    occurred.has("awaiting_additional_payment") ||
    currentStatus === "awaiting_additional_payment"
  ) {
    stages.push("awaiting_additional_payment");
  }
  stages.push("approved", "prescribed", "sent_to_pharmacy", "dispatched", "delivered");

  const currentIdx = STATUS_ORDER[currentStatus] ?? 0;

  return stages.map((key) => {
    const idx = STATUS_ORDER[key] ?? 0;
    const state: TimelineStep["state"] =
      idx < currentIdx ? "done" : idx === currentIdx ? "current" : "upcoming";
    return { key, label: patientStatusLabel(key), state, at: atByStatus.get(key) ?? null };
  });
}
