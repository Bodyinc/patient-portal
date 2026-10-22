import Link from "next/link";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { getManualRefillBlock } from "@/lib/orders/refill-eligibility";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import { fetchShopCheckoutBootstrapData } from "@/lib/shop/service-data";
import { getCustomerCreditCents, getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import { formatSavedCardLabel, getDefaultPaymentMethod } from "@/lib/stripe/payment-methods";
import DashboardHeader from "../../_components/DashboardHeader";
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
    const refillBlock = await getManualRefillBlock(user.id, medicineId);
    if (refillBlock) {
      const identity = await getPatientDisplayIdentity(user.id);
      return (
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-x-hidden px-4 py-4 sm:px-6 lg:px-1">
          <DashboardHeader
            fullName={identity.fullName}
            patientId={toPatientId(user.id)}
            avatarUrl={identity.avatarUrl}
          />
          <section className="rounded-[16px] border border-[#E8EEED] bg-white p-5 sm:p-8">
            <h1 className="text-xl font-medium tracking-[-0.4px] text-[#152A51] sm:text-2xl">
              Refill request
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#152A51]/80 sm:text-base">
              {refillBlock}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/my-meds"
                className="inline-flex h-[46px] items-center justify-center rounded-full bg-[#152A51] px-6 text-sm font-medium text-white hover:bg-[#152A51]/90"
              >
                Go to My Meds
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-[46px] items-center justify-center rounded-full border border-[#152A51]/20 bg-white px-6 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6]"
              >
                Back to Shop
              </Link>
            </div>
          </section>
        </main>
      );
    }

    const [bootstrap, walletCreditCents, identity, savedCardLabel] = await Promise.all([
      fetchShopCheckoutBootstrapData({ medicineId, variantId }),
      getCustomerCreditCents(user.id),
      getPatientDisplayIdentity(user.id),
      (async () => {
        try {
          const identity = await getPatientDisplayIdentity(user.id);
          const customerId = await getOrCreateStripeCustomer({
            userId: user.id,
            email: user.email ?? null,
            name: identity.stripeName,
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
          fullName={identity.fullName}
          patientId={toPatientId(user.id)}
          avatarUrl={identity.avatarUrl}
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
