import { toast } from "sonner";
import { ensurePatientRole, getMyRole } from "@/lib/actions/patient-auth";
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

  if (role && role !== "patient") {
    await supabase.auth.signOut();
    toast.error(
      `This email is registered on the ${role} portal. Please sign in at ${role}.bodyinc.com — you cannot use the patient portal.`,
      { duration: 8000 },
    );
    return false;
  }

  if (!role) {
    await ensurePatientRole();
  }

  return true;
}
