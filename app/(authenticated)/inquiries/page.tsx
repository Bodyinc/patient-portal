import { requirePatientSession } from "@/lib/auth/require-patient";
import { listMyInquiries } from "@/lib/actions/feedback";

import InquiriesPageClient from "./_components/InquiriesPageClient";

export const metadata = {
  title: "My inquiries",
};

export default async function InquiriesPage() {
  await requirePatientSession();

  try {
    const inquiries = await listMyInquiries();
    return (
      <main className="min-w-0 flex-1 bg-white p-3 sm:p-4">
        <InquiriesPageClient inquiries={inquiries} />
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 bg-white p-4">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load your inquiries."}
        </div>
      </main>
    );
  }
}
