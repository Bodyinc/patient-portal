/** Display order id: #BI- + first 4 hex chars of the entity UUID (same pattern as patient ID). */
export function formatOrderId(uuid: string): string {
  const compact = uuid.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}
