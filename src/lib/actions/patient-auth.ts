"use server";

import { z } from "zod";
import { PORTAL_ROLE } from "@/lib/auth/constants";
import {
  classifyPatientEmail,
  findAuthUserByEmail,
  type CheckEmailResult,
} from "@/lib/auth/patient-email";
import { claimIntakeSession } from "@/lib/actions/intake";
import { requireIntakeSession } from "@/lib/intake/session";
import { verificationCodeEmail } from "@/lib/email/auth-emails";
import { sendTransactionalEmail } from "@/lib/email/send";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { userHasSetPassword } from "@/lib/auth/password-state";
import { stripe } from "@/lib/stripe/server";

export type { CheckEmailResult };

export type MyRoleResult = { role: "patient" | "provider" | "admin" | null };

export type PostCheckoutAccountResult =
  | { ok: true; email: string; created: boolean }
  | { ok: false; code: "session_error" | "incomplete" | "wrong_portal" | "error"; message: string };

export type CompletePostCheckoutSignInResult =
  | { ok: true; email: string; tokenHash: string }
  | {
      ok: false;
      code: "session_error" | "incomplete" | "wrong_portal" | "existing_account" | "error";
      message: string;
    };

function isDuplicateEmailError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already exists") ||
    lower.includes("duplicate")
  );
}

// Server-action wrapper so client components can classify an email over the network.
export async function checkPatientEmail(rawEmail: string): Promise<CheckEmailResult> {
  return classifyPatientEmail(rawEmail);
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { supabase, userId: user.id };
}

export async function getMyRole(): Promise<MyRoleResult> {
  const auth = await getAuthenticatedClient();
  if (!auth) return { role: null };

  const { data, error } = await auth.supabase.rpc("get_my_role");
  if (error) return { role: null };
  return { role: (data as MyRoleResult["role"]) ?? null };
}

export async function ensurePatientRole(): Promise<MyRoleResult> {
  const auth = await getAuthenticatedClient();
  if (!auth) return { role: null };

  const { data: existing } = await auth.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.userId)
    .maybeSingle();

  const role = (existing as { role: MyRoleResult["role"] } | null)?.role;
  if (role) {
    return { role };
  }

  await supabaseAdmin.from("user_roles").insert({ user_id: auth.userId, role: PORTAL_ROLE });
  return { role: PORTAL_ROLE };
}

async function ensurePatientRoleForUser(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (existing as { role: MyRoleResult["role"] } | null)?.role;
  if (role && role !== PORTAL_ROLE) {
    return { ok: false as const, role };
  }

  if (!role) {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: PORTAL_ROLE });
    if (error) {
      return { ok: false as const, role: null };
    }
  }

  return { ok: true as const, role: PORTAL_ROLE };
}

export async function hasPassword(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return userHasSetPassword(user, supabase);
}

// Called after a patient sets a password outside the setInitialPassword action (e.g. the
// forgot-password / reset flow), so the password_set authority stays accurate and they aren't
// re-prompted to set one.
export async function markPasswordSet(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, password_set: true },
  });
  return { ok: true };
}

const passwordSchema = z.string().min(8).max(72);

export type SetInitialPasswordResult = { ok: true } | { ok: false; message: string };

export async function setInitialPassword(rawPassword: string): Promise<SetInitialPasswordResult> {
  const parsed = passwordSchema.safeParse(rawPassword);
  if (!parsed.success) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Your session expired. Sign in again." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { ok: false, message: error.message ?? "Could not set your password." };
  }

  // app_metadata is replaced wholesale by updateUserById — spread the existing object or the
  // `role` key that requirePatientSession() reads would be wiped.
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, password_set: true },
  });

  return { ok: true };
}

const changeEmailSchema = z.string().trim().email().max(255);

export type ChangeCheckoutEmailResult =
  { ok: true; email: string } | { ok: false; message: string };

// Step 1 of an email change: only re-point the account's LOGIN email so a one-time code can
// be sent to the new address. The visible "reflect" (profile + Stripe customer + admin) is
// deferred to reconcileCheckoutEmail(), which runs only AFTER that code is verified.
export async function changeCheckoutEmail(newEmailRaw: string): Promise<ChangeCheckoutEmailResult> {
  const parsed = changeEmailSchema.safeParse(newEmailRaw);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const newEmail = parsed.data.toLowerCase();

  // Prefer the authenticated user (change AFTER OTP verification); otherwise the intake
  // session (change at the OTP screen, before sign-in).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId: string;
  let currentEmail: string | null | undefined;

  if (user) {
    userId = user.id;
    currentEmail = user.email ?? null;
  } else {
    const sessionResult = await requireIntakeSession();
    if ("error" in sessionResult) {
      return { ok: false, message: sessionResult.error };
    }
    const session = sessionResult.session;
    if (!session.claimed_by_user_id) {
      return { ok: false, message: "Complete checkout before changing your email." };
    }
    userId = session.claimed_by_user_id;
    currentEmail = session.email;
  }

  if (currentEmail?.toLowerCase() === newEmail) {
    return { ok: true, email: newEmail };
  }

  const { user: existing } = await findAuthUserByEmail(newEmail);
  if (existing && existing.id !== userId) {
    return { ok: false, message: "That email is already in use by another account." };
  }

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  });
  if (updateErr) {
    return { ok: false, message: updateErr.message ?? "Could not update email." };
  }

  // The auth→profiles email trigger (on_auth_user_email_update) just copied newEmail into
  // profiles.email. Revert it so the admin Patients view keeps showing the current email until
  // the new one's OTP is verified — reconcileCheckoutEmail() does the real propagation after.
  if (currentEmail) {
    await supabaseAdmin.from("profiles").update({ email: currentEmail }).eq("id", userId);
  }

  return { ok: true, email: newEmail };
}

// Step 2: after the new email's OTP is verified, propagate it to the places that reflect
// externally — the profile row and the Stripe customer (the subscription follows the customer).
export async function reconcileCheckoutEmail(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false };

  await supabaseAdmin.from("profiles").update({ email: user.email }).eq("id", user.id);
  await supabaseAdmin
    .from("intake_sessions")
    .update({ email: user.email })
    .eq("claimed_by_user_id", user.id);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.stripe_customer_id) {
    try {
      await stripe.customers.update(profile.stripe_customer_id, { email: user.email });
    } catch {
      // Non-fatal.
    }
  }
  return { ok: true };
}

export async function claimCheckoutForCurrentUser(): Promise<{ ok: boolean }> {
  const auth = await getAuthenticatedClient();
  if (!auth) return { ok: false };
  await claimIntakeSession(auth.userId);
  return { ok: true };
}

export async function preparePostCheckoutAccount(): Promise<PostCheckoutAccountResult> {
  const sessionResult = await requireIntakeSession();
  if ("error" in sessionResult) {
    return { ok: false, code: "session_error", message: sessionResult.error };
  }

  const session = sessionResult.session;
  const email = session.email?.trim().toLowerCase();
  const fullName = session.full_name?.trim();
  const dob = session.dob;

  if (!email || !fullName || !dob) {
    return {
      ok: false,
      code: "incomplete",
      message: "Complete your personal information before checkout.",
    };
  }

  const { user: existing, error: lookupErr } = await findAuthUserByEmail(email);
  if (lookupErr) {
    return { ok: false, code: "error", message: "Could not verify account. Try again." };
  }

  if (existing) {
    const roleResult = await ensurePatientRoleForUser(existing.id);
    if (!roleResult.ok) {
      return {
        ok: false,
        code: "wrong_portal",
        message: `An account with this email already exists on the ${roleResult.role} portal.`,
      };
    }

    await claimIntakeSession(existing.id);
    return { ok: true, email, created: false };
  }

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    // No password is set here, but GoTrue still writes a placeholder hash — so mark the account
    // explicitly as password-less. userHasSetPassword() trusts this flag over the has_password RPC.
    app_metadata: { role: PORTAL_ROLE, password_set: false },
    user_metadata: {
      full_name: fullName,
      phone: session.phone ?? null,
      phone_country_code: session.phone_country_code ?? null,
      dob,
    },
  });

  if (createErr) {
    if (isDuplicateEmailError(createErr.message)) {
      const { user: found } = await findAuthUserByEmail(email);
      if (found) {
        const roleResult = await ensurePatientRoleForUser(found.id);
        if (!roleResult.ok) {
          return {
            ok: false,
            code: "wrong_portal",
            message: `An account with this email already exists on the ${roleResult.role} portal.`,
          };
        }
        await claimIntakeSession(found.id);
        return { ok: true, email, created: false };
      }
    }
    return {
      ok: false,
      code: "error",
      message: createErr.message ?? "Could not create account.",
    };
  }

  if (!created.user) {
    return { ok: false, code: "error", message: "Could not create account." };
  }

  const roleResult = await ensurePatientRoleForUser(created.user.id);
  if (!roleResult.ok) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return { ok: false, code: "error", message: "Could not assign patient role." };
  }

  await claimIntakeSession(created.user.id);
  return { ok: true, email, created: true };
}

/**
 * After guest payment: create/claim the account and return a one-time magic-link token hash
 * so the client can establish a session without sending an OTP email.
 * Existing accounts are not auto-signed-in (defensive — personal-info already blocks them).
 */
export async function completePostCheckoutSignIn(): Promise<CompletePostCheckoutSignInResult> {
  const accountResult = await preparePostCheckoutAccount();
  if (!accountResult.ok) {
    return accountResult;
  }

  if (!accountResult.created) {
    return {
      ok: false,
      code: "existing_account",
      message: "An account with this email already exists. Please log in to access your order.",
    };
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: accountResult.email,
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return {
      ok: false,
      code: "error",
      message: error?.message ?? "Could not start your session. Please try logging in.",
    };
  }

  return { ok: true, email: accountResult.email, tokenHash };
}

/** Sends a login OTP using the Body Inc email theme (does not use the Supabase Auth template). */
export async function sendPatientLoginOtp(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z.string().trim().email("Enter a valid email").safeParse(email);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: parsed.data,
  });
  if (error) return { ok: false, message: error.message };

  const code = data?.properties?.email_otp?.trim();
  if (!code) {
    return { ok: false, message: "Could not send a verification code. Please try again." };
  }

  let fullName: string | null = null;
  if (data.user?.id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle();
    fullName = profile?.full_name ?? null;
  }

  const { subject, html } = verificationCodeEmail({ code, fullName });
  const sent = await sendTransactionalEmail({ to: parsed.data, subject, html });
  if (!sent) {
    return { ok: false, message: "Could not send email. Please try again." };
  }
  return { ok: true };
}
