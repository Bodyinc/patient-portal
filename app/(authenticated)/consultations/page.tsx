import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchConsultationsPageData } from "@/lib/consultations/service-data";

import ConsultationsPageClient from "./_components/ConsultationsPageClient";

export const metadata = {
  title: "Consultations",
};

export default async function ConsultationsPage() {
  const { user } = await requirePatientSession();

  try {
    const data = await fetchConsultationsPageData(user.id);
    return <ConsultationsPageClient data={data} />;
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 p-4">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load consultations."}
        </div>
      </main>
    );
  }
}
