const TECHNICAL =
  /PGRST|postgres|violates|duplicate key|\bcolumn\b|\brelation\b|syntax error|\bJWT\b|TypeError|ECONN|ENOTFOUND|fetch failed|No such |invalid input syntax|schema cache|row-level security|permission denied|null value in column|unexpected token|Supabase|stripe_|password authentication failed|status code \d{3}|<html|undefined is not|Cannot read propert|resource_missing|invalid api key|api key/i;

const REWRITES: Array<[RegExp, string]> = [
  [
    /no intake session|session not found|session expired|session is no longer active|^invalid session$/i,
    "Your session expired. Please start again.",
  ],
  [/user already registered/i, "An account with this email already exists."],
  [/invalid login credentials/i, "Incorrect email or password."],
  [/email rate limit|over_email_send_rate_limit/i, "Please wait a moment, then try again."],
  [/no such price/i, "This plan is not available for purchase yet."],
  [
    /^string must contain|expected string|^required$|^invalid enum|^invalid input|^invalid type/i,
    "",
  ],
];

/** Turn database, Stripe, and other internal failures into a sentence a patient can act on. */
export function userFacingMessage(raw: unknown, fallback: string): string {
  const message = (typeof raw === "string" ? raw : raw instanceof Error ? raw.message : "")
    .replace(/\s+/g, " ")
    .trim();
  if (!message) return fallback;

  for (const [pattern, replacement] of REWRITES) {
    if (pattern.test(message)) return replacement || fallback;
  }

  if (message.length > 220 || TECHNICAL.test(message)) return fallback;
  return message;
}
