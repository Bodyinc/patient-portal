"use server";

import { z } from "zod";
import { PORTAL_ROLE } from "@/lib/auth/constants";
import { claimIntakeSession } from "@/lib/actions/intake";
import { requireIntakeSession } from "@/lib/intake/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type SignupResult =
  | { ok: true }
  | { ok: false; code: "wrong_portal"; role: string; message: string }
  | { ok: false; code: "exists"; message: string }
  | { ok: false; code: "error"; message: string };

export type MyRoleResult = { role: "patient" | "provider" | "admin" | null };

export type PostCheckoutAccountResult =
  | { ok: true; email: string; created: boolean }
  | { ok: false; code: "session_error" | "incomplete" | "wrong_portal" | "error"; message: string };

function isDuplicateEmailError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already exists") ||
    lower.includes("duplicate")
  );
}

async function findAuthUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { user: null, error };
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === normalized);
    if (found) return { user: found, error: null };
    if (data.users.length < 200) break;
  }
  return { user: null, error: null };
}

async function getExistingUserSignupResult(email: string): Promise<SignupResult> {
  const { user: found, error: lookupErr } = await findAuthUserByEmail(email);

  if (lookupErr || !found) {
    return { ok: false, code: "error", message: "Could not verify email. Try again." };
  }

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", found.id)
    .maybeSingle();

  const role = (roleRow as { role: MyRoleResult["role"] } | null)?.role;
  if (role && role !== PORTAL_ROLE) {
    return {
      ok: false,
      code: "wrong_portal",
      role,
      message: `An account with this email already exists on the ${role} portal. Please sign in at ${role}.bodyinc.com.`,
    };
  }

  return {
    ok: false,
    code: "exists",
    message: "An account with this email already exists. Please sign in instead.",
  };
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

export async function signUpPatient(input: z.infer<typeof signupSchema>): Promise<SignupResult> {
  const data = signupSchema.parse(input);

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.fullName,
      phone: data.phone || null,
      dob: data.dob,
    },
  });

  if (createErr) {
    if (isDuplicateEmailError(createErr.message)) {
      return getExistingUserSignupResult(data.email);
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

  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: created.user.id, role: PORTAL_ROLE });

  if (roleErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return { ok: false, code: "error", message: "Could not assign role. Try again." };
  }

  await claimIntakeSession(created.user.id);

  return { ok: true };
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
    user_metadata: {
      full_name: fullName,
      phone: session.phone ?? null,
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
