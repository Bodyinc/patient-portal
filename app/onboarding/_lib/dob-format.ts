const ISO_DOB = /^\d{4}-\d{2}-\d{2}$/;

export function isoDobToDisplay(iso: string): string {
  if (!ISO_DOB.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

export function displayDobToIso(display: string): string | null {
  const match = display.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  const monthNum = Number(month);
  const dayNum = Number(day);
  const yearNum = Number(year);

  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;

  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== yearNum ||
    parsed.getUTCMonth() !== monthNum - 1 ||
    parsed.getUTCDate() !== dayNum
  ) {
    return null;
  }

  return iso;
}

export function isoDobToParts(iso: string): { month: string; day: string; year: string } {
  if (!ISO_DOB.test(iso)) return { month: "", day: "", year: "" };
  const [year, month, day] = iso.split("-");
  return { month, day, year };
}

export function partsToIsoDob(parts: { month: string; day: string; year: string }): string | null {
  const { month, day, year } = parts;
  if (month.length !== 2 || day.length !== 2 || year.length !== 4) return null;
  return displayDobToIso(`${month}/${day}/${year}`);
}

/** Allow partial MM drafts that can still become 01–12 (rejects 00, 13–99, etc.). */
export function isValidMonthDraft(value: string): boolean {
  if (!value) return true;
  if (!/^\d{1,2}$/.test(value)) return false;
  if (value.length === 1) return value >= "0" && value <= "9";
  const month = Number(value);
  return month >= 1 && month <= 12;
}

/** Allow partial DD drafts that can still become 01–31 (rejects 00, 32–99, etc.). */
export function isValidDayDraft(value: string): boolean {
  if (!value) return true;
  if (!/^\d{1,2}$/.test(value)) return false;
  if (value.length === 1) return value >= "0" && value <= "9";
  const day = Number(value);
  return day >= 1 && day <= 31;
}

/** Allow partial YYYY drafts (4 digits, reasonable birth years handled on full date). */
export function isValidYearDraft(value: string): boolean {
  if (!value) return true;
  return /^\d{1,4}$/.test(value);
}

export function isoDobToDate(iso: string): Date | undefined {
  if (!ISO_DOB.test(iso)) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateToIsoDob(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
