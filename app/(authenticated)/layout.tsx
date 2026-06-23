import { requirePatientSession } from "@/lib/auth/require-patient";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  await requirePatientSession();
  return children;
}
