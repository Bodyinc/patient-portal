const BREVO_SMTP_HOST = "smtp-relay.brevo.com";

/** True when a send can actually be attempted. A relay hostname is not an SMTP login. */
export function isEmailTransportConfigured(): boolean {
  if (!process.env.EMAIL_FROM?.trim()) return false;

  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (apiKey && !apiKey.startsWith("xsmtpsib-")) return true;

  const login = process.env.BREVO_SMTP_LOGIN?.trim();
  const pass = process.env.BREVO_SMTP_KEY?.trim();
  if (!login || !pass) return false;
  if (login === BREVO_SMTP_HOST || /smtp-relay\.brevo\.com/i.test(login)) return false;
  return true;
}

export const EMAIL_TRANSPORT_HINT =
  "Brevo is not configured. Set BREVO_API_KEY (xkeysib-…), or set BREVO_SMTP_LOGIN to the SMTP login (…@smtp-brevo.com), not smtp-relay.brevo.com.";
