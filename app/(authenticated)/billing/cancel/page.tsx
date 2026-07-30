import Link from "next/link";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { getBillingSubscriptionForCancel } from "@/lib/billing/service-data";
import CancelSubscriptionClient from "./_components/CancelSubscriptionClient";

export default async function BillingCancelPage({
  searchParams,
}: {
  searchParams?: Promise<{
    subscriptionId?: string;
  }>;
}) {
  const { user } = await requirePatientSession();
  const params = (await searchParams) ?? {};
  const subscriptionId = params.subscriptionId;

  if (!subscriptionId) {
    return (
      <main className="min-w-0 flex-1 bg-[#F3F6F6] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Missing subscription context.{" "}
          <Link href="/billing" className="font-medium underline">
            Return to Billing
          </Link>
        </div>
      </main>
    );
  }

  try {
    const subscription = await getBillingSubscriptionForCancel({
      userId: user.id,
      subscriptionId,
    });

    if (!subscription) {
      return (
        <main className="min-w-0 flex-1 bg-[#F3F6F6] p-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Subscription not found.{" "}
            <Link href="/billing" className="font-medium underline">
              Return to Billing
            </Link>
          </div>
        </main>
      );
    }

    if (subscription.cancelAtPeriodEnd) {
      return (
        <main className="min-w-0 flex-1 bg-[#F3F6F6] p-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This subscription is already scheduled to cancel at the end of the billing period.{" "}
            <Link href="/billing" className="font-medium underline">
              Return to Billing
            </Link>
          </div>
        </main>
      );
    }

    return (
      <main className="min-w-0 flex-1 bg-[#F3F6F6] p-3 sm:p-4">
        <CancelSubscriptionClient subscription={subscription} />
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 bg-[#F3F6F6] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load cancellation page."}
        </div>
      </main>
    );
  }
}
