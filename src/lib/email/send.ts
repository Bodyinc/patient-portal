import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const BREVO_SMTP_HOST = "smtp-relay.brevo.com";
const BREVO_SMTP_PORT = 587;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

let transporter: Transporter | null = null;
// Cache key, so editing the SMTP credentials in .env rebuilds the transport instead of
// reusing a connection pool still bound to the old (rejected) login.
let transporterAuth: string | null = null;

function getTransporter(login: string, key: string): Transporter {
  const auth = `${login}:${key}`;
  if (!transporter || transporterAuth !== auth) {
    transporter = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port: BREVO_SMTP_PORT,
      secure: false,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user: login, pass: key },
      // Windows often stalls ~20–60s on IPv6 to smtp-relay.brevo.com before falling back.
      family: 4,
    } as SMTPTransport.Options);
    transporterAuth = auth;
  }
  return transporter;
}

function parseFromAddress(from: string): { email: string; name?: string } {
  const trimmed = from.trim();
  const match = trimmed.match(/^(?:"([^"]*)"|([^<]*?))\s*<([^>]+)>$/);
  if (match) {
    const name = (match[1] ?? match[2] ?? "").trim();
    const email = match[3].trim();
    return name ? { email, name } : { email };
  }
  return { email: trimmed };
}

function restApiKey(): string | null {
  const key = process.env.BREVO_API_KEY?.trim();
  if (!key) return null;
  // SMTP keys 401 the REST API. Do not even try them there.
  if (key.startsWith("xsmtpsib-")) {
    console.error(
      "[email] BREVO_API_KEY is an SMTP key (xsmtpsib-). Use a REST API key (xkeysib-) from Brevo → SMTP & API → API keys.",
    );
    return null;
  }
  return key;
}

function smtpAuth(): { user: string; pass: string } | null {
  const login = process.env.BREVO_SMTP_LOGIN?.trim();
  const pass = process.env.BREVO_SMTP_KEY?.trim();
  if (!login || !pass) return null;
  // The host is hardcoded above. Using it as the username always 535s and can stall serverless.
  if (login === BREVO_SMTP_HOST || /smtp-relay\.brevo\.com/i.test(login)) {
    console.error(
      "[email] BREVO_SMTP_LOGIN is the relay host, not the SMTP login. Use the Login value from Brevo → SMTP & API → SMTP (looks like xxx@smtp-brevo.com).",
    );
    return null;
  }
  return { user: login, pass };
}

async function sendViaBrevoApi(params: {
  to: string;
  subject: string;
  html: string;
  from: string;
  apiKey: string;
}): Promise<boolean> {
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": params.apiKey,
    },
    body: JSON.stringify({
      sender: parseFromAddress(params.from),
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[email] Brevo API ${res.status}:`, text.slice(0, 400));
    return false;
  }
  return true;
}

// Logs instead of throwing so Stripe webhooks and checkout never fail because of mail.
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const from = process.env.EMAIL_FROM?.trim();
  const apiKey = restApiKey();
  const smtp = smtpAuth();

  if (!from) {
    console.warn(`[email] EMAIL_FROM not set — skipped "${params.subject}" to ${params.to}`);
    return false;
  }
  if (!apiKey && !smtp) {
    console.warn(
      `[email] set BREVO_API_KEY (preferred) or BREVO_SMTP_LOGIN + BREVO_SMTP_KEY — skipped "${params.subject}" to ${params.to}`,
    );
    return false;
  }

  try {
    // HTTP is much faster than SMTP on serverless (no TLS handshake to the relay).
    if (apiKey && (await sendViaBrevoApi({ ...params, from, apiKey }))) return true;

    if (!smtp) return false;
    await getTransporter(smtp.user, smtp.pass).sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error("[email] send failed:", error);
    return false;
  }
}
