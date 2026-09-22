import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase Auth "Send Email" hook.
 * Always ACK 200 so generateLink (OTP, reset, checkout session) never fails.
 * Themed login OTP / reset mail is sent from here via Brevo. Checkout magic
 * links pass email_skip=1 and stay silent.
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
  const payload = await request.text();
  const secret = hookSecretBytes();
  const signed = secret ? verifyStandardWebhook(payload, request, secret) : false;

  if (secret && !signed) {
    console.warn("[auth-hook] invalid signature — acked so Auth still issues the token");
    return NextResponse.json({});
  }
  if (!secret) {
    console.warn("[auth-hook] SEND_EMAIL_HOOK_SECRET missing — acked without sending");
    return NextResponse.json({});
  }

  try {
    const body = JSON.parse(payload) as {
      user?: {
        id?: string;
        email?: string;
        user_metadata?: { full_name?: string | null };
      };
      email_data?: {
        token?: string;
        token_hash?: string;
        redirect_to?: string;
        email_action_type?: string;
        site_url?: string;
      };
    };
    const { deliverSupabaseAuthEmail } = await import("@/lib/email/auth-hook");
    await deliverSupabaseAuthEmail(body);
  } catch (error) {
    console.error("[auth-hook] deliver failed:", error);
  }

  return NextResponse.json({});
}
