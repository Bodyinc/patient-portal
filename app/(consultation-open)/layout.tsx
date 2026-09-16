import { requirePatientSession } from "@/lib/auth/require-patient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ConsultationOpenLayout({ children }: { children: React.ReactNode }) {
  await requirePatientSession();
  return children;
}
