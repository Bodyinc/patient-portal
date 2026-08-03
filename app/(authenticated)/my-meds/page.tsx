import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchMyMedsPageData } from "@/lib/my-meds/service-data";
import { fetchActivePortalOffer } from "@/lib/offers/service-data";
import { buildReferralLink, getReferralSummary } from "@/lib/referrals";
import MyMedsPageClient from "./_components/MyMedsPageClient";

const PAGE_SIZE = 5;

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
    const [data, referral, offer] = await Promise.all([
      fetchMyMedsPageData(user.id, {
        page,
        pageSize: PAGE_SIZE,
        query,
      }),
      getReferralSummary(user.id),
      fetchActivePortalOffer().catch((err) => {
        console.error("[portal_offers] My Meds load failed:", err);
        return null;
      }),
    ]);

    return (
      <main className="mx-auto w-full max-w-[1440px] flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-1">
        <MyMedsPageClient
          data={data}
          fullName={user.user_metadata?.full_name ?? "Patient"}
          patientId={toPatientId(user.id)}
          avatarUrl={(user.user_metadata?.avatar_url as string | null | undefined) ?? null}
          referralCode={referral?.code ?? "BODYINC"}
          referralLink={referral?.link ?? buildReferralLink("BODYINC")}
          rewardCents={referral?.rewardCents ?? 0}
          offer={offer}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 p-4">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load medication data."}
        </div>
      </main>
    );
  }
}
