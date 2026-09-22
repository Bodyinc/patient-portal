import DashboardShell from "./_components/DashboardShell";
import { requirePatientSession } from "@/lib/auth/require-patient";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  await requirePatientSession();
  return <DashboardShell>{children}</DashboardShell>;
}
