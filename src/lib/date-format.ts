/** Portal-wide display format: MM/DD/YYYY */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function partsToPortalDate(month: string, day: string, year: string): string {
  return `${month}/${day}/${year}`;
}

/** Format an ISO date string (YYYY-MM-DD) as MM/DD/YYYY. */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = iso.match(ISO_DATE);
  if (!match) return "—";
  const [, year, month, day] = match;
  return partsToPortalDate(month, day, year);
}

/** Format a Date or ISO timestamp for display as MM/DD/YYYY. */
export function formatPortalDate(value: string | Date | null | undefined): string {
  if (!value) return "—";

  if (typeof value === "string") {
    const isoMatch = value.match(ISO_DATE);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return partsToPortalDate(month, day, year);
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return partsToPortalDate(month, day, year);
}
