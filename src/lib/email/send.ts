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

async function sendViaBrevoApi(params: {
  to: string;
  subject: string;
  html: string;
  from: string;
}): Promise<"sent" | "unavailable" | "failed"> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return "unavailable";
  // SMTP keys (xsmtpsib-…) 401 the REST API and then stall on the SMTP fallback.

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
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
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[email] Brevo API request error:", error);
    return "failed";
  }
}

// Logs instead of throwing so Stripe webhooks and checkout never fail because of mail.
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const login = process.env.BREVO_SMTP_LOGIN;
  const key = process.env.BREVO_SMTP_KEY;
  const from = process.env.EMAIL_FROM;
  if (!from || (!process.env.BREVO_API_KEY && (!login || !key))) {
    console.warn(
      `[email] BREVO_SMTP_LOGIN/BREVO_SMTP_KEY/EMAIL_FROM not set — skipped "${params.subject}" to ${params.to}`,
    );
    return false;
  }

  try {
    // HTTP is much faster than SMTP on serverless (no TLS handshake to the relay).
    const apiResult = await sendViaBrevoApi({ ...params, from });
    if (apiResult === "sent") return true;

    if (!login || !key) return false;
    await getTransporter(login, key).sendMail({
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
