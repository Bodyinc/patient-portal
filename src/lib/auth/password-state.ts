import "server-only";

import type { User } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// GoTrue writes a placeholder bcrypt hash into auth.users.encrypted_password even for accounts
// created without one (admin.createUser), so the has_password RPC — which only checks that the
// hash is non-empty — reports true for a passwordless account. The password_set app_metadata flag
// is the real authority: it is explicitly false for checkout-created accounts and set true only
// once the patient actually chooses a password. Accounts predating the flag carry neither value,
// so fall back to the RPC for those (they have real credentials and must not be re-prompted).
export async function userHasSetPassword(
  user: User,
  supabase: ServerSupabaseClient,
): Promise<boolean> {
  const flag = user.app_metadata?.password_set;
  if (flag === true) return true;
  if (flag === false) return false;

  const { data, error } = await supabase.rpc("has_password");
  // A transient failure must never force a set-password redirect (or lock a patient out).
  if (error) return true;
  return data === true;
}
