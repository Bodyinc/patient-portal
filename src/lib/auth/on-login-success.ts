import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";

export async function onLoginSuccess(
  router: AppRouterInstance,
  message = "Welcome back",
): Promise<boolean> {
  toast.success(message);
  router.refresh();
  router.push("/dashboard");
  return true;
}
