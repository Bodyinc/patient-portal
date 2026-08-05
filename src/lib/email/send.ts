import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const BREVO_SMTP_HOST = "smtp-relay.brevo.com";
const BREVO_SMTP_PORT = 587;

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
      auth: { user: login, pass: key },
    });
    transporterAuth = auth;
  }
  return transporter;
}

// Fire-and-forget: a mail failure must never fail the Stripe webhook (Stripe would
// retry the whole event), so this logs instead of throwing. Returns whether the
// email was accepted, so reminder jobs can decide if a send should be recorded.
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const login = process.env.BREVO_SMTP_LOGIN;
  const key = process.env.BREVO_SMTP_KEY;
  const from = process.env.EMAIL_FROM;
  if (!login || !key || !from) {
    console.warn(
      `[email] BREVO_SMTP_LOGIN/BREVO_SMTP_KEY/EMAIL_FROM not set — skipped "${params.subject}" to ${params.to}`,
    );
    return false;
  }

  try {
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
