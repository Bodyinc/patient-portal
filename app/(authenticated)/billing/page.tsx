import { requirePatientSession } from "@/lib/auth/require-patient";
import { fetchBillingPageData } from "@/lib/billing/service-data";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";
import { getReferralSummary } from "@/lib/referrals";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import {
  formatCardExpiry,
  formatSavedCardLabel,
  getDefaultPaymentMethod,
} from "@/lib/stripe/payment-methods";
import { getWalletSummary } from "@/lib/wallet";
import BillingPageClient from "./_components/BillingPageClient";

const PAGE_SIZE = 10;

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

export default async function BillingPage({
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
    const identity = await getPatientDisplayIdentity(user.id);
    const [data, referral, wallet, savedCard] = await Promise.all([
      fetchBillingPageData(user.id, {
        page,
        pageSize: PAGE_SIZE,
        query,
      }),
      getReferralSummary(user.id),
      getWalletSummary(user.id),
      (async () => {
        try {
          const customerId = await getOrCreateStripeCustomer({
            userId: user.id,
            email: user.email ?? null,
            name: identity.stripeName,
          });
          const pm = await getDefaultPaymentMethod(customerId);
          if (!pm) return { cardLabel: null, cardExpiry: null };
          return {
            cardLabel: formatSavedCardLabel(pm),
            cardExpiry: formatCardExpiry(pm),
          };
        } catch {
          return { cardLabel: null, cardExpiry: null };
        }
      })(),
    ]);

    return (
      <main className="min-w-0 flex-1 bg-white p-3 sm:p-4">
        <BillingPageClient
          data={data}
          fullName={identity.fullName}
          patientId={toPatientId(user.id)}
          avatarUrl={identity.avatarUrl}
          referral={referral}
          wallet={wallet}
          cardLabel={savedCard.cardLabel}
          cardExpiry={savedCard.cardExpiry}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 bg-white p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load billing data."}
        </div>
      </main>
    );
  }
}
