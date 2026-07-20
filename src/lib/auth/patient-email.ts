import "server-only";

import { z } from "zod";

import { PORTAL_ROLE } from "@/lib/auth/constants";
import { supabaseAdmin } from "@/lib/supabase/admin";

const emailInputSchema = z.string().trim().email().max(255);

export type CheckEmailResult =
  | { status: "new" }
  | { status: "patient" }
  | { status: "wrong_portal"; role: string }
  | { status: "invalid" }
  | { status: "error" };

export async function findAuthUserByEmail(email: string) {
  const normalized = email.toLowerCase();

  // profiles.email mirrors auth and is queryable in one round trip — avoids paging
  // through the entire auth user list just to classify a duplicate-email signup.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("email", normalized)
    .maybeSingle();
  if (profile) return { user: { id: profile.id, email: profile.email }, error: null };

  // Auth user without a profile row (edge case) — fall back to the scan.
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { user: null, error };
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === normalized);
    if (found) return { user: found, error: null };
    if (data.users.length < 200) break;
  }
  return { user: null, error: null };
}

// Classifies an email against the auth system so login (password + OTP) and the onboarding
// email gate share one source of truth. "new" = no account; "patient" = existing patient;
// "wrong_portal" = a provider/admin account.
export async function classifyPatientEmail(rawEmail: string): Promise<CheckEmailResult> {
  const parsed = emailInputSchema.safeParse(rawEmail);
  if (!parsed.success) return { status: "invalid" };
  const email = parsed.data.toLowerCase();

  const { user: found, error: lookupErr } = await findAuthUserByEmail(email);
  if (lookupErr) return { status: "error" };
  if (!found) return { status: "new" };

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", found.id)
    .maybeSingle();

  const role = (roleRow as { role: string | null } | null)?.role;
  if (role && role !== PORTAL_ROLE) return { status: "wrong_portal", role };
  return { status: "patient" };
}
