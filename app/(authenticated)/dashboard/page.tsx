import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchDashboardPageData } from "@/lib/dashboard/service-data";

import DashboardPageClient from "./_components/DashboardPageClient";

export default async function DashboardPage() {
  const { user } = await requirePatientSession();
  const data = await fetchDashboardPageData(user.id);

  return <DashboardPageClient data={data} />;
}
