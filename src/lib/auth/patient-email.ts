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

async function findAuthUserWithoutProfile(normalized: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { user: null, error: null };

  try {
    const res = await fetch(
      `${url}/auth/v1/admin/users?page=1&per_page=2&email=${encodeURIComponent(normalized)}`,
      {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
        cache: "no-store",
      },
    );
    if (!res.ok) return { user: null, error: null };
    const body = (await res.json()) as {
      users?: Array<{ id: string; email?: string | null }>;
    };
    const found = body.users?.find((u) => (u.email ?? "").toLowerCase() === normalized);
    if (found) return { user: { id: found.id, email: found.email ?? normalized }, error: null };
  } catch {
    // Best-effort — treat as not found rather than paging the whole user list.
  }
  return { user: null, error: null };
}

export async function findAuthUserByEmail(email: string) {
  const normalized = email.toLowerCase();

  // profiles.email is unique and stored lowercase — one indexed lookup instead of ILIKE
  // or paging through Auth Admin users on every login / signup check.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("email", normalized)
    .maybeSingle();
  if (profile) return { user: { id: profile.id, email: profile.email }, error: null };

  return findAuthUserWithoutProfile(normalized);
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
