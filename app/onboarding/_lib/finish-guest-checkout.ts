"use client";

import { completePostCheckoutSignIn } from "@/lib/actions/patient-auth";
import { createClient } from "@/lib/supabase/client";

export type FinishGuestCheckoutResult = { ok: true } | { ok: false; message: string };

/**
 * Creates the post-payment account (if needed) and establishes a browser session
 * via a one-time magic-link token — no OTP email.
 */
export async function finishGuestCheckoutSession(): Promise<FinishGuestCheckoutResult> {
  const result = await completePostCheckoutSignIn();
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: result.tokenHash,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Could not start your session. Please try logging in.",
    };
  }

  return { ok: true };
}
