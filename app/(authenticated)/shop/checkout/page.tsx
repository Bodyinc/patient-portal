import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchShopCheckoutBootstrapData } from "@/lib/shop/service-data";
import { getCustomerCreditCents, getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import { formatSavedCardLabel, getDefaultPaymentMethod } from "@/lib/stripe/payment-methods";
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
    package?: string;
  }>;
}) {
  const { user } = await requirePatientSession();
  const params = (await searchParams) ?? {};
  const medicineId = params.id;
  const variantId = params.variant ?? null;
  const packageId = params.package ?? null;
  const from = params.from ?? null;

  if (!medicineId) {
    return (
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-x-hidden px-4 py-4 sm:px-6 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-1">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Missing product context. Please return to Shop and choose a product.
        </div>
      </main>
    );
  }

  try {
    const [bootstrap, walletCreditCents, savedCardLabel] = await Promise.all([
      fetchShopCheckoutBootstrapData({ medicineId, variantId }),
      getCustomerCreditCents(user.id),
      (async () => {
        try {
          const customerId = await getOrCreateStripeCustomer({
            userId: user.id,
            email: user.email ?? null,
            name: (user.user_metadata?.full_name as string | undefined) ?? null,
          });
          const pm = await getDefaultPaymentMethod(customerId);
          return pm ? formatSavedCardLabel(pm) : null;
        } catch {
          return null;
        }
      })(),
    ]);

    return (
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-x-hidden px-4 py-4 sm:px-6 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-1">
        <ShopCheckoutClient
          bootstrap={bootstrap}
          fullName={user.user_metadata?.full_name ?? "Patient"}
          patientId={toPatientId(user.id)}
          avatarUrl={(user.user_metadata?.avatar_url as string | null | undefined) ?? null}
          medicineId={medicineId}
          from={from}
          initialPackageId={packageId}
          walletCreditCents={walletCreditCents}
          savedCardLabel={savedCardLabel}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-x-hidden px-4 py-4 sm:px-6 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-1">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load checkout data."}
        </div>
      </main>
    );
  }
}
