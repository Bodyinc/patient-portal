import { requirePatientSession } from "@/lib/auth/require-patient";
import { buildReferralLink, getReferralSummary } from "@/lib/referrals";
import { fetchShopCatalogData, fetchShopCategoriesData } from "@/lib/shop/service-data";
import type { ShopSortOption } from "@/lib/shop/types";
import ShopCatalogClient from "./_components/ShopCatalogClient";
import ShopReferralCard from "./_components/ShopReferralCard";

const PAGE_SIZE = 6;

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

function getSortOption(value: string | undefined): ShopSortOption {
  if (value === "price_asc") return "price_asc";
  if (value === "price_desc") return "price_desc";
  if (value === "name_asc") return "name_asc";
  return "popular";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    sort?: string;
    page?: string;
    q?: string;
  }>;
}) {
  const { user } = await requirePatientSession();
  const patientId = toPatientId(user.id);
  const fullName = user.user_metadata?.full_name ?? "Patient";

  const resolvedSearchParams = (await searchParams) ?? {};
  const category = resolvedSearchParams.category ?? null;
  const sortBy = getSortOption(resolvedSearchParams.sort);
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const searchQuery = (resolvedSearchParams.q ?? "").trim();

  try {
    // Direct data-layer calls — the previous version fetched this app's own API
    // routes over HTTP, paying two extra localhost round trips per page view.
    const [categories, list, referral] = await Promise.all([
      fetchShopCategoriesData(),
      fetchShopCatalogData({
        categorySlug: category,
        sortBy,
        page,
        pageSize: PAGE_SIZE,
        searchQuery,
      }),
      getReferralSummary(user.id),
    ]);

    return (
      <main className="mx-auto w-full max-w-[1440px] flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-1">
        <div className="space-y-4">
          <ShopCatalogClient
            categories={categories}
            initialList={list}
            pageSize={PAGE_SIZE}
            fullName={fullName}
            patientId={patientId}
            avatarUrl={(user.user_metadata?.avatar_url as string | null | undefined) ?? null}
            topContent={
              <>
                <section className="space-y-1 px-1">
                  <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[28px]">
                    Shop
                  </h1>
                  <p className="text-sm text-[#152A51]/80 sm:text-[15px]">
                    Browse medications and healthcare products available for your treatment journey.
                  </p>
                </section>

                <ShopReferralCard
                  referralCode={referral?.code ?? "BODYINC"}
                  referralLink={referral?.link ?? buildReferralLink("BODYINC")}
                  rewardCents={referral?.rewardCents ?? 0}
                />
              </>
            }
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 p-4">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load shop data."}
        </div>
      </main>
    );
  }
}
