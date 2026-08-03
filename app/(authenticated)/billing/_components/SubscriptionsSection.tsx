import Link from "next/link";

import SubscriptionRow from "./SubscriptionRow";
import type { BillingSubscriptionDto } from "./types";

type SubscriptionsSectionProps = {
  subscriptions: BillingSubscriptionDto[];
  onCancel: (subscription: BillingSubscriptionDto) => void;
};

export default function SubscriptionsSection({
  subscriptions,
  onCancel,
}: SubscriptionsSectionProps) {
  const activeCount = subscriptions.length;

  return (
    <section className="rounded-md border border-[#E8EEED] bg-white p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-[#152A51]">Your Subscriptions</h2>
        <p className="text-sm text-[#152A51]/70">
          {activeCount} Active Subscription{activeCount === 1 ? "" : "s"}
        </p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#E8EEED] bg-[#F3F6F6] px-4 py-8 text-center">
          <p className="text-sm text-[#152A51]/70">No active subscriptions yet.</p>
          <Link
            href="/shop"
            className="mt-3 inline-flex rounded-md bg-[#152A51] px-4 py-2 text-sm font-medium text-white hover:bg-[#152A51]/90"
          >
            Browse Shop
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.id}
              subscription={subscription}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </section>
  );
}
