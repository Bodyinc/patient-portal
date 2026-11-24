import { redirect } from "next/navigation";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { loadConsultationEligibility, patientCanSeeShop } from "@/lib/consultations/eligibility";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePatientSession();
  const eligibility = await loadConsultationEligibility(user.id);
  if (!patientCanSeeShop(eligibility, user)) redirect("/dashboard");
  return children;
}
