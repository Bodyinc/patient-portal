import "server-only";

import { redirect } from "next/navigation";
import { ensurePatientRole } from "@/lib/actions/patient-auth";
import { PORTAL_ROLE, WRONG_PORTAL_GENERIC_MESSAGE } from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/constants";

export async function requirePatientSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: role, error } = await supabase.rpc("get_my_role");

  if (!error && role && role !== PORTAL_ROLE) {
    await supabase.auth.signOut();
    redirect("/auth?error=wrong_portal");
  }

  if (!error && !role) {
    await ensurePatientRole();
  }

  return { user, supabase, role: (role as AppRole | null) ?? null };
}
