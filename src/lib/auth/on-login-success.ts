import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";
import { enforcePatientPortalAccess } from "@/lib/enforce-patient-access";

export async function onLoginSuccess(
  router: AppRouterInstance,
  message = "Welcome back",
): Promise<boolean> {
  const allowed = await enforcePatientPortalAccess();
  if (!allowed) return false;

  toast.success(message);
  router.push("/dashboard");
  router.refresh();
  return true;
}
