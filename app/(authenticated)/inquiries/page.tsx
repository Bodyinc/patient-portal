import { requirePatientSession } from "@/lib/auth/require-patient";
import { userFacingMessage } from "@/lib/user-message";
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
          {userFacingMessage(
            error,
            "We couldn't load your inquiries. Please refresh and try again.",
          )}
        </div>
      </main>
    );
  }
}
