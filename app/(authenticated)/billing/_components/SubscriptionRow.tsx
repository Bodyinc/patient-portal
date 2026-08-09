"use client";

import { useRouter } from "next/navigation";

import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";

import type { BillingSubscriptionDto } from "./types";
import { formatPortalDate } from "@/lib/date-format";

type SubscriptionRowProps = {
  subscription: BillingSubscriptionDto;
  onCancel: (subscription: BillingSubscriptionDto) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return formatPortalDate(value);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function SubscriptionRow({ subscription, onCancel }: SubscriptionRowProps) {
  const router = useRouter();

  function handleUpgrade() {
    if (!subscription.medicineId) return;
    router.push(
      buildShopCheckoutHref({
        medicineId: subscription.medicineId,
        variantId: subscription.variantId,
        packageId: subscription.packageId,
        from: "billing",
      }),
    );
  }

  return (
    <article className="rounded-md border border-[#E8EEED] bg-[#F3F6F6] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <img
            src={subscription.imageSrc}
            alt={subscription.medicineName}
            className="h-20 w-20 shrink-0 rounded-md border border-[#E8EEED] object-cover"
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#152A51]">{subscription.medicineName}</h3>
            {subscription.variantName || subscription.planLabel ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {subscription.variantName ? (
                  <span className="rounded-full bg-[#E8EEED] px-2 py-0.5 text-[11px] font-medium text-[#152A51]">
                    {subscription.variantName}
                  </span>
                ) : null}
                {subscription.planLabel ? (
                  <span className="rounded-full border border-[#D5DFDE] px-2 py-0.5 text-[11px] font-medium text-[#152A51]/80">
                    {subscription.planLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="mt-1 text-sm text-[#152A51]/70">{subscription.description}</p>
            {subscription.cancelAtPeriodEnd ? (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Cancels at end of billing period
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:min-w-[280px]">
          <div>
            <p className="text-xs text-[#152A51]/60">Next Billing Date</p>
            <p className="mt-1 text-sm font-medium text-[#152A51]">
              {formatDate(subscription.nextBillingDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#152A51]/60">Upcoming Charge</p>
            <p className="mt-1 text-sm font-semibold text-[#152A51]">
              {formatCurrency(subscription.upcomingCharge)}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={!subscription.medicineId}
            className="w-full rounded-md border border-[#152A51] px-4 py-2 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Upgrade
          </button>
          <button
            type="button"
            onClick={() => onCancel(subscription)}
            disabled={subscription.cancelAtPeriodEnd}
            className="w-full rounded-md border border-[#D5DFDE] bg-white px-4 py-2 text-sm text-[#152A51]/80 hover:bg-[#F3F6F6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </article>
  );
}
