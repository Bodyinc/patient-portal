import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchMyMedsPageData } from "@/lib/my-meds/service-data";
import { buildReferralLink, getReferralSummary } from "@/lib/referrals";
import MyMedsPageClient from "./_components/MyMedsPageClient";

const PAGE_SIZE = 10;

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

export default async function MyMedsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    q?: string;
  }>;
}) {
  const { user } = await requirePatientSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const query = (resolvedSearchParams.q ?? "").trim();

  try {
    const [data, referral] = await Promise.all([
      fetchMyMedsPageData(user.id, {
        page,
        pageSize: PAGE_SIZE,
        query,
      }),
      getReferralSummary(user.id),
    ]);

    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-3 sm:p-4">
        <MyMedsPageClient
          data={data}
          fullName={user.user_metadata?.full_name ?? "Patient"}
          patientId={toPatientId(user.id)}
          avatarUrl={(user.user_metadata?.avatar_url as string | null | undefined) ?? null}
          referralCode={referral?.code ?? "BODYINC"}
          referralLink={referral?.link ?? buildReferralLink("BODYINC")}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load medication data."}
        </div>
      </main>
    );
  }
}
