import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PORTAL_ROLE = "patient" as const;

const signupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  dob: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type SignupResult =
  | { ok: true }
  | { ok: false; code: "wrong_portal"; role: string; message: string }
  | { ok: false; code: "exists"; message: string }
  | { ok: false; code: "error"; message: string };

export const signUpPatient = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }): Promise<SignupResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      return { ok: false, code: "error", message: "Could not verify email. Try again." };
    }
    const found = list.users.find(
      (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );

    if (found) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", found.id)
        .maybeSingle();

      if (roleRow?.role && roleRow.role !== PORTAL_ROLE) {
        return {
          ok: false,
          code: "wrong_portal",
          role: roleRow.role,
          message: `An account with this email already exists on the ${roleRow.role} portal. Please sign in at ${roleRow.role}.bodyinc.com.`,
        };
      }
      return {
        ok: false,
        code: "exists",
        message: "An account with this email already exists. Please sign in instead.",
      };
    }

    // Create the auth user with profile metadata
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

    // Assign patient role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: PORTAL_ROLE });

    if (roleErr) {
      // Roll back the auth user so the email is free to retry
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false, code: "error", message: "Could not assign role. Try again." };
    }

    return { ok: true };
  });

export type MyRoleResult = { role: "patient" | "provider" | "admin" | null };

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRoleResult> => {
    const { data, error } = await context.supabase.rpc("get_my_role");
    if (error) return { role: null };
    return { role: (data as MyRoleResult["role"]) ?? null };
  });

// Ensures the signed-in user has the patient role assigned (idempotent).
// Used as a self-heal if a user exists in auth but lacks a role row.
export const ensurePatientRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.role) {
      return { role: existing.role as MyRoleResult["role"] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: PORTAL_ROLE });
    return { role: PORTAL_ROLE };
  });
