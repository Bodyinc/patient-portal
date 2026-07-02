import { headers } from "next/headers";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { getShopCatalogFromService, getShopCategoriesFromService } from "@/lib/shop/client";
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
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const baseUrl = host ? `${protocol}://${host}` : undefined;

  const { user } = await requirePatientSession();
  const patientId = toPatientId(user.id);
  const fullName = user.user_metadata?.full_name ?? "Patient";

  const resolvedSearchParams = (await searchParams) ?? {};
  const category = resolvedSearchParams.category ?? null;
  const sortBy = getSortOption(resolvedSearchParams.sort);
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const searchQuery = (resolvedSearchParams.q ?? "").trim();

  try {
    const [categories, list] = await Promise.all([
      getShopCategoriesFromService({ baseUrl }),
      getShopCatalogFromService(
        {
          category,
          sort: sortBy,
          page,
          pageSize: PAGE_SIZE,
          q: searchQuery,
        },
        { baseUrl },
      ),
    ]);

    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-3 sm:p-4">
        <div className="space-y-3">
          <ShopCatalogClient
            categories={categories}
            initialList={list}
            pageSize={PAGE_SIZE}
            fullName={fullName}
            patientId={patientId}
            avatarUrl={(user.user_metadata?.avatar_url as string | null | undefined) ?? null}
            topContent={
              <>
                <section className="space-y-1 px-1 pt-1">
                  <h1 className="text-2xl font-semibold text-[#2E00AB]">Shop</h1>
                  <p className="text-sm text-[#2E00AB]/70">
                    Browse medications and healthcare products available for your treatment journey.
                  </p>
                </section>

                <ShopReferralCard referralCode="BODYINC-REF-2024" />
              </>
            }
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load shop data."}
        </div>
      </main>
    );
  }
}
