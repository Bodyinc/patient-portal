import { requirePatientSession } from "@/lib/auth/require-patient";
import { loadConsultationEligibility, patientCanSeeShop } from "@/lib/consultations/eligibility";
import { fetchDashboardPageData } from "@/lib/dashboard/service-data";

import DashboardPageClient from "./_components/DashboardPageClient";

export default async function DashboardPage() {
  const { user } = await requirePatientSession();
  const [data, eligibility] = await Promise.all([
    fetchDashboardPageData(user.id),
    loadConsultationEligibility(user.id),
  ]);

  return <DashboardPageClient data={data} showShop={patientCanSeeShop(eligibility, user)} />;
}
