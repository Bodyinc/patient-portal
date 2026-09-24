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
};

/**
 * The form appointment is saved at start. After submit, QuickBlox opens a second
 * appointment (the room). Reopen must use that room id when it exists.
 */
export function visitIdToOpen(params: { storedId: string; openAppointments: OpenVisit[] }): string {
  const room = params.openAppointments.find(
    (item) => item.hasDialog && item.id !== params.storedId,
  );
  return room?.id ?? params.storedId;
}
