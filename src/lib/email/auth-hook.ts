import "server-only";

import {
  AUTH_EMAIL_SKIP_QUERY,
  AUTH_MAGICLINK_CLAIM,
  AUTH_RECOVERY_CLAIM,
  passwordResetEmail,
  verificationCodeEmail,
  type VerificationEmailPurpose,
} from "./auth-emails";
import { sendOnce } from "./idempotency";
import { sendTransactionalEmail } from "./send";

type AuthHookPayload = {
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

function purposeFromRedirect(redirectTo: string | undefined): VerificationEmailPurpose {
  if (!redirectTo) return "login";
  try {
    const url = new URL(redirectTo);
    if (url.searchParams.get("purpose") === "change_email") return "change_email";
  } catch {
    if (redirectTo.includes("purpose=change_email")) return "change_email";
  }
  return "login";
}

function shouldSkipCheckoutEmail(redirectTo: string | undefined): boolean {
  return Boolean(redirectTo?.includes(AUTH_EMAIL_SKIP_QUERY));
}

function recoveryActionLink(params: { tokenHash: string; redirectTo: string }): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!supabaseUrl) return null;
  const url = new URL(`${supabaseUrl}/auth/v1/verify`);
  url.searchParams.set("token", params.tokenHash);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("redirect_to", params.redirectTo);
  return url.toString();
}

/**
 * Send themed OTP / reset mail from the Auth hook so generateLink never depends
 * on the app sending afterwards. Checkout magic links pass email_skip=1 and stay silent.
 */
export async function deliverSupabaseAuthEmail(payload: AuthHookPayload): Promise<void> {
  const action = payload.email_data?.email_action_type?.trim();
  const email = payload.user?.email?.trim();
  const userId = payload.user?.id?.trim();
  const redirectTo = payload.email_data?.redirect_to?.trim() ?? "";
  const fullName = payload.user?.user_metadata?.full_name ?? null;

  if (!action || !email || !userId) {
    console.info(
      "[auth-hook] skipped send — missing action, email, or user id",
      action ?? "unknown",
    );
    return;
  }

  if (
    action === "magiclink" &&
    (shouldSkipCheckoutEmail(redirectTo) || redirectTo.includes("/auth/callback"))
  ) {
    console.info("[auth-hook] skipped checkout magic link for", email);
    return;
  }

  if (action === "magiclink" || action === "signup" || action === "email_change") {
    const code = payload.email_data?.token?.trim();
    if (!code) {
      console.warn("[auth-hook] no OTP token for", action);
      return;
    }
    const purpose: VerificationEmailPurpose =
      action === "email_change" || purposeFromRedirect(redirectTo) === "change_email"
        ? "change_email"
        : "login";
    const { subject, html } = verificationCodeEmail({ code, fullName, purpose });
    await sendOnce(
      AUTH_MAGICLINK_CLAIM,
      userId,
      () => sendTransactionalEmail({ to: email, subject, html }),
      code,
    );
    return;
  }

  if (action === "recovery") {
    const tokenHash = payload.email_data?.token_hash?.trim();
    if (!tokenHash) {
      console.warn("[auth-hook] no recovery token_hash");
      return;
    }
    const resetUrl = recoveryActionLink({
      tokenHash,
      redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`,
    });
    if (!resetUrl) {
      console.warn("[auth-hook] NEXT_PUBLIC_SUPABASE_URL missing — cannot build reset link");
      return;
    }
    const { subject, html } = passwordResetEmail({ resetUrl, fullName });
    await sendOnce(
      AUTH_RECOVERY_CLAIM,
      userId,
      () => sendTransactionalEmail({ to: email, subject, html }),
      tokenHash,
    );
  }
}
