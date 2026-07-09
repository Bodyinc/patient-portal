"use client";

import { useRouter } from "next/navigation";

import type { BillingSubscriptionDto } from "./types";

type SubscriptionRowProps = {
  subscription: BillingSubscriptionDto;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function SubscriptionRow({ subscription }: SubscriptionRowProps) {
  const router = useRouter();

  function handleUpgrade() {
    if (!subscription.medicineId) return;
    router.push(`/shop/checkout?id=${encodeURIComponent(subscription.medicineId)}&from=billing`);
  }

  function handleCancel() {
    router.push(`/billing/cancel?subscriptionId=${encodeURIComponent(subscription.id)}`);
  }

  return (
    <article className="rounded-md border border-[#EEE9FF] bg-[#FCFBFF] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <img
            src={subscription.imageSrc}
            alt={subscription.medicineName}
            className="h-14 w-14 shrink-0 rounded-md border border-[#E6DEFF] object-cover"
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#2E00AB]">{subscription.medicineName}</h3>
            <p className="mt-1 text-sm text-[#2E00AB]/70">{subscription.description}</p>
            {subscription.cancelAtPeriodEnd ? (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Cancels at end of billing period
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:min-w-[280px]">
          <div>
            <p className="text-xs text-[#2E00AB]/60">Next Billing Date</p>
            <p className="mt-1 text-sm font-medium text-[#2E00AB]">
              {formatDate(subscription.nextBillingDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#2E00AB]/60">Upcoming Charge</p>
            <p className="mt-1 text-sm font-semibold text-[#2E00AB]">
              {formatCurrency(subscription.upcomingCharge)}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={!subscription.medicineId}
            className="w-full rounded-md border border-[#2E00AB] px-4 py-2 text-sm font-medium text-[#2E00AB] hover:bg-[#F6F3FF] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Upgrade
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={subscription.cancelAtPeriodEnd}
            className="w-full rounded-md border border-[#D5CAFF] bg-white px-4 py-2 text-sm text-[#2E00AB]/80 hover:bg-[#FAF8FF] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </article>
  );
}
