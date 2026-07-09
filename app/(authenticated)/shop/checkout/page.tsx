import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchShopCheckoutBootstrapData } from "@/lib/shop/service-data";
import ShopCheckoutClient from "./_components/ShopCheckoutClient";

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

export default async function ShopCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{
    id?: string;
    name?: string;
    category?: string;
    description?: string;
    image?: string;
    price?: string;
    from?: string;
  }>;
}) {
  const { user } = await requirePatientSession();
  const params = (await searchParams) ?? {};
  const medicineId = params.id;
  const from = params.from ?? null;

  if (!medicineId) {
    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Missing product context. Please return to Shop and choose a product.
        </div>
      </main>
    );
  }

  try {
    const bootstrap = await fetchShopCheckoutBootstrapData({ medicineId });

    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-3 sm:p-4">
        <ShopCheckoutClient
          bootstrap={bootstrap}
          fullName={user.user_metadata?.full_name ?? "Patient"}
          patientId={toPatientId(user.id)}
          avatarUrl={(user.user_metadata?.avatar_url as string | null | undefined) ?? null}
          medicineId={medicineId}
          from={from}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load checkout data."}
        </div>
      </main>
    );
  }
}
