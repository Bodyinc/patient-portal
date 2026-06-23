"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PORTAL_ROLE = "patient" as const;

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

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, userId: user.id };
}

export async function signUpPatient(input: z.infer<typeof signupSchema>): Promise<SignupResult> {
  const data = signupSchema.parse(input);

  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return { ok: false, code: "error", message: "Could not verify email. Try again." };
  }
  const found = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());

  if (found) {
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

  if (createErr || !created.user) {
    return {
      ok: false,
      code: "error",
      message: createErr?.message ?? "Could not create account.",
    };
  }

  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: created.user.id, role: PORTAL_ROLE });

  if (roleErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return { ok: false, code: "error", message: "Could not assign role. Try again." };
  }

  return { ok: true };
}

export async function getMyRole(): Promise<MyRoleResult> {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("get_my_role");
  if (error) return { role: null };
  return { role: (data as MyRoleResult["role"]) ?? null };
}

export async function ensurePatientRole(): Promise<MyRoleResult> {
  const { supabase, userId } = await getAuthenticatedClient();

  const { data: existing } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (existing as { role: MyRoleResult["role"] } | null)?.role;
  if (role) {
    return { role };
  }

  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: PORTAL_ROLE });
  return { role: PORTAL_ROLE };
}
