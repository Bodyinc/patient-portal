import Link from "next/link";
import { requirePatientSession } from "@/lib/auth/require-patient";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PrescriptionDocument from "./_components/PrescriptionDocument";

export default async function PrescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ download?: string }>;
}) {
  const { user } = await requirePatientSession();
  const { id } = await params;
  const sp = (await searchParams) ?? {};

  const { data: rx } = await supabaseAdmin
    .from("prescriptions")
    .select("id, user_id, provider_id, medicine_name, directions, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!rx || rx.user_id !== user.id) {
    return (
      <main className="min-w-0 flex-1 bg-[#F3F6F6] p-4">
        <div className="mx-auto max-w-2xl rounded-xl border border-[#E8EEED] bg-white p-6 text-center text-sm text-[#152A51]/70">
          Prescription not found.
          <div className="mt-2">
            <Link href="/my-meds" className="font-medium text-[#152A51] underline">
              Back to My Meds
            </Link>
          </div>
        </div>
      </main>
    );
  }

  let providerName: string | null = null;
  if (rx.provider_id) {
    const { data: prov } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", rx.provider_id)
      .maybeSingle();
    providerName = prov?.full_name ?? null;
  }

  const patientName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Patient";

  return (
    <main className="min-w-0 flex-1 bg-[#F3F6F6] p-3 sm:p-4 print:bg-white print:p-0">
      <PrescriptionDocument
        prescription={{
          id: rx.id,
          medicineName: rx.medicine_name,
          directions: rx.directions,
          createdAt: rx.created_at,
          patientName,
          providerName,
        }}
        autoPrint={!!sp.download}
      />
    </main>
  );
}
