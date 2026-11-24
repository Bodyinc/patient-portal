import DashboardShell from "./_components/DashboardShell";
import { requirePatientSession } from "@/lib/auth/require-patient";
import { loadConsultationEligibility, patientCanSeeShop } from "@/lib/consultations/eligibility";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePatientSession();
  const eligibility = await loadConsultationEligibility(user.id);
  return (
    <DashboardShell
      showConsultations={eligibility.showNav}
      showShop={patientCanSeeShop(eligibility, user)}
    >
      {children}
    </DashboardShell>
  );
}
