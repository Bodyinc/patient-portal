export type StoredConsultation = {
  subscriptionId: string;
  appointmentId: string | null;
};

/**
 * The id to open for this plan.
 * A saved visit is always reopened. A new id is only allowed when this plan has none yet.
 */
export function appointmentIdToReopen(
  rows: StoredConsultation[],
  subscriptionId: string,
): string | null {
  const mine = rows.find((row) => row.subscriptionId === subscriptionId);
  const saved = mine?.appointmentId?.trim();
  return saved ? saved : null;
}

export type OpenVisit = {
  id: string;
  /** Set after the patient submits the intake form. That visit is the provider room. */
  hasDialog: boolean;
  hasFormSubmission?: boolean;
  createdAt?: number;
};

/**
 * The form appointment is saved at start. After submit, QuickBlox opens a second
 * appointment (the room). Reopen must use that room id when it exists.
 */
export function visitIdToOpen(params: { storedId: string; openAppointments: OpenVisit[] }): string {
  if (params.openAppointments.length === 0) {
    return params.storedId;
  }

  // 1. If an appointment has a completed form submission, that is the active provider room
  const withFormSubmission = params.openAppointments.find((item) => item.hasFormSubmission);
  if (withFormSubmission) {
    return withFormSubmission.id;
  }

  // 2. If another open appointment exists besides storedId, that was created after the form
  const otherAppointments = params.openAppointments.filter((item) => item.id !== params.storedId);
  if (otherAppointments.length > 0) {
    // Prefer one with a dialog if available
    const withDialog = otherAppointments.find((item) => item.hasDialog);
    if (withDialog) {
      return withDialog.id;
    }
    // Otherwise prefer the newest created
    const stored = params.openAppointments.find((item) => item.id === params.storedId);
    const newer = otherAppointments.find(
      (item) => (item.createdAt ?? 0) >= (stored?.createdAt ?? 0),
    );
    if (newer) {
      return newer.id;
    }
    return otherAppointments[0].id;
  }

  return params.storedId;
}
