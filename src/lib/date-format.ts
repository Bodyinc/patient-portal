/** Portal-wide display format: MM/DD/YYYY */

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

function partsToPortalDate(month: string, day: string, year: string): string {
  return `${month}/${day}/${year}`;
}

function localPortalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return partsToPortalDate(month, day, year);
}

/** Format a stored calendar date (YYYY-MM-DD, even with a time suffix) as MM/DD/YYYY. */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = iso.trim().match(ISO_DATE_PREFIX);
  if (!match) return "—";
  const [, year, month, day] = match;
  return partsToPortalDate(month, day, year);
}

/**
 * Format a Date or timestamp as MM/DD/YYYY.
 * Strings that start with YYYY-MM-DD keep that calendar day (no timezone shift).
 */
export function formatPortalDate(value: string | Date | null | undefined): string {
  if (!value) return "—";

  if (typeof value === "string") {
    const isoMatch = value.trim().match(ISO_DATE_PREFIX);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return partsToPortalDate(month, day, year);
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return localPortalDate(date);
}

/** Format a Date or timestamp as MM/DD/YYYY, h:mm AM/PM. */
export function formatPortalDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${localPortalDate(date)}, ${time}`;
}
