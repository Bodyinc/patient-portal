import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { ensurePatientRole } from "@/lib/actions/patient-auth";
import { PORTAL_ROLE, WRONG_PORTAL_GENERIC_MESSAGE } from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/auth/constants";

// cache(): layout and page both call this on every navigation — dedupe to one
// getUser + one role lookup per request instead of two of each (~640ms saved/page).
export const requirePatientSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  // The role rides along in the JWT's app_metadata (set at signup / backfilled), so
  // the common case costs zero extra round trips. The RPC remains as fallback for
  // accounts that predate the metadata, and the result is persisted for next time.
  let role = (user.app_metadata?.role as AppRole | undefined) ?? null;

  if (!role) {
    const { data: rpcRole, error } = await supabase.rpc("get_my_role");
    if (!error && rpcRole) {
      role = rpcRole as AppRole;
      void supabaseAdmin.auth.admin
        .updateUserById(user.id, { app_metadata: { role } })
        .catch(() => {});
    }
    if (!error && !rpcRole) {
      await ensurePatientRole();
      role = PORTAL_ROLE;
    }
  }

  if (role && role !== PORTAL_ROLE) {
    await supabase.auth.signOut();
    redirect("/auth?error=wrong_portal");
  }

  // Checkout creates accounts with no password. Same metadata-cache trick as the role above —
  // the RPC is the authority, app_metadata is the zero-round-trip fast path. On RPC error fall
  // through rather than redirect: a transient DB failure must not lock a patient out.
  if (user.app_metadata?.password_set !== true) {
    const { data: hasPw, error } = await supabase.rpc("has_password");
    if (!error && hasPw) {
      void supabaseAdmin.auth.admin
        .updateUserById(user.id, { app_metadata: { ...user.app_metadata, password_set: true } })
        .catch(() => {});
    } else if (!error && !hasPw) {
      redirect("/set-password");
    }
  }

  return { user, supabase, role };
});
