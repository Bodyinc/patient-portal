import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase Auth "Send Email" hook.
 * Returning 200 here replaces the dashboard SMTP templates (the old purple Magic Link /
 * Reset Password / Confirm signup mail). Login OTP and password reset are sent from the
 * app via Brevo. Checkout generateLink must not email the patient at all.
 *
 * Dashboard: Authentication → Hooks → Send Email → HTTPS endpoint
 *   {NEXT_PUBLIC_APP_URL}/api/auth/send-email-hook
 * Secret: SEND_EMAIL_HOOK_SECRET (v1,whsec_…)
 */
function hookSecretBytes(): Buffer | null {
  const raw = process.env.SEND_EMAIL_HOOK_SECRET?.trim();
  if (!raw) return null;
  const b64 = raw.replace(/^v1,/, "").replace(/^whsec_/, "");
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

function signaturesMatch(header: string, expectedB64: string): boolean {
  return header.split(/\s+/).some((part) => {
    const token = part.trim();
    if (!token) return false;
    const givenB64 = token.includes(",") ? token.slice(token.indexOf(",") + 1) : token;
    const given = Buffer.from(givenB64);
    const expected = Buffer.from(expectedB64);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

function verifyStandardWebhook(payload: string, request: Request, secret: Buffer): boolean {
  const msgId = request.headers.get("webhook-id") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  const sigHeader = request.headers.get("webhook-signature") ?? "";
  if (!msgId || !timestamp || !sigHeader) return false;

  const expected = createHmac("sha256", secret)
    .update(`${msgId}.${timestamp}.${payload}`)
    .digest("base64");
  return signaturesMatch(sigHeader, expected);
}

export async function POST(request: Request) {
  const secret = hookSecretBytes();
  if (!secret) {
    return NextResponse.json(
      { error: "SEND_EMAIL_HOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const payload = await request.text();
  if (!verifyStandardWebhook(payload, request, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const body = JSON.parse(payload) as {
      email_data?: { email_action_type?: string };
    };
    console.info(
      "[auth-hook] swallowed supabase email",
      body.email_data?.email_action_type ?? "unknown",
    );
  } catch {
    // Payload verified; ignore JSON parse issues and still ack so Auth does not fall back to SMTP.
  }

  return NextResponse.json({});
}
