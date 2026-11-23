import { redirect } from "next/navigation";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { loadConsultationEligibility } from "@/lib/consultations/eligibility";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePatientSession();
  const eligibility = await loadConsultationEligibility(user.id);
  if (!eligibility.showShop) redirect("/dashboard");
  return children;
}
