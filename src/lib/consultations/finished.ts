/** Provider finished the visit. QuickBlox can still report the room as open. */
export function isConsultationFinishedEvent(event: {
  note?: string | null;
  status?: string | null;
}): boolean {
  const note = (event.note ?? "").toLowerCase();
  const status = (event.status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (
    status === "consultation_completed" ||
    status === "consultation_finished" ||
    status === "consultation_complete" ||
    status === "visit_completed" ||
    status === "visit_complete" ||
    status === "appointment_completed" ||
    status === "appointment_complete" ||
    status === "call_completed" ||
    status === "call_complete"
  ) {
    return true;
  }
  return (
    note.includes("consultation complete") ||
    note.includes("consultation finished") ||
    note.includes("visit complete") ||
    note.includes("appointment complete") ||
    note.includes("call complete") ||
    (note.includes("call outcome") && note.includes("completed"))
  );
}
