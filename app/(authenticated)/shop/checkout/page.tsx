import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchShopCheckoutBootstrapData } from "@/lib/shop/service-data";
import { getCustomerCreditCents } from "@/lib/stripe/customers";
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
    variant?: string;
  }>;
}) {
  const { user } = await requirePatientSession();
  const params = (await searchParams) ?? {};
  const medicineId = params.id;
  const variantId = params.variant ?? null;
  const from = params.from ?? null;

  if (!medicineId) {
    return (
      <main className="mx-auto min-w-0 w-full max-w-[1440px] flex-1 p-4 sm:px-6">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Missing product context. Please return to Shop and choose a product.
        </div>
      </main>
    );
  }

  try {
    const [bootstrap, walletCreditCents] = await Promise.all([
      fetchShopCheckoutBootstrapData({ medicineId, variantId }),
      getCustomerCreditCents(user.id),
    ]);

    return (
      <main className="mx-auto min-w-0 w-full max-w-[1440px] flex-1 px-4 py-4 sm:px-6 lg:px-6 xl:px-8">
        <ShopCheckoutClient
          bootstrap={bootstrap}
          fullName={user.user_metadata?.full_name ?? "Patient"}
          patientId={toPatientId(user.id)}
          avatarUrl={(user.user_metadata?.avatar_url as string | null | undefined) ?? null}
          medicineId={medicineId}
          from={from}
          walletCreditCents={walletCreditCents}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="mx-auto min-w-0 w-full max-w-[1440px] flex-1 p-4 sm:px-6">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load checkout data."}
        </div>
      </main>
    );
  }
}
