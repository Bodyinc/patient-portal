import { toast } from "sonner";
import { ensurePatientRole, getMyRole } from "@/lib/actions/patient-auth";
import { PORTAL_ROLE, wrongPortalMessage } from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/client";

export async function enforcePatientPortalAccess(): Promise<boolean> {
  const supabase = createClient();
  let role: string | null = null;

  try {
    const r = await getMyRole();
    role = r.role;
  } catch {
    role = null;
  }

  if (role && role !== PORTAL_ROLE) {
    await supabase.auth.signOut();
    toast.error(wrongPortalMessage(role), { duration: 8000 });
    return false;
  }

  if (!role) {
    const healed = await ensurePatientRole();
    if (healed.role && healed.role !== PORTAL_ROLE) {
      await supabase.auth.signOut();
      toast.error(wrongPortalMessage(healed.role), { duration: 8000 });
      return false;
    }
  }

  return true;
}
