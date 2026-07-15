import Link from "next/link";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { getShopCheckoutOrderByIdData } from "@/lib/shop/service-data";
import { reconcileLatestSubscriptionForUser } from "@/lib/stripe/reconcile";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function ShopCheckoutConfirmationPage({
  searchParams,
}: {
  searchParams?: Promise<{ orderId?: string }>;
}) {
  const { user } = await requirePatientSession();
  await reconcileLatestSubscriptionForUser(user.id);
  const params = (await searchParams) ?? {};
  const orderId = params.orderId;

  if (!orderId) {
    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Missing order id.
        </div>
      </main>
    );
  }

  try {
    const order = await getShopCheckoutOrderByIdData({ userId: user.id, orderId });

    const isPaid = order.status === "paid";
    const statusLabel = isPaid
      ? "Paid"
      : order.status === "pending_payment"
        ? "Pending payment"
        : order.status;
    // Post-payment, the Stripe invoice is the truth; before that, the order estimate.
    const walletApplied =
      order.walletApplied ?? Math.max(0, order.subtotal - order.promoSavings - order.total);
    const totalPaid = order.totalPaid ?? order.total;

    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <section className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-[#E6DEFF] bg-white p-6">
          <h1 className="text-3xl font-semibold text-[#2E00AB]">
            {isPaid ? "Order Confirmed" : "Order Created"}
          </h1>
          <p className="text-sm text-[#2E00AB]/75">
            {isPaid ? (
              <>Your payment was successful and your order is confirmed.</>
            ) : (
              <>
                Your order has been created and is currently{" "}
                <span className="font-semibold">{statusLabel.toLowerCase()}</span>.
              </>
            )}
          </p>

          <div className="grid gap-2 rounded-md border border-[#EEE9FF] bg-[#FCFBFF] p-4 text-sm text-[#2E00AB]/80">
            <p>
              <span className="font-semibold text-[#2E00AB]">Order ID:</span> {order.id}
            </p>
            <p>
              <span className="font-semibold text-[#2E00AB]">Product:</span> {order.productName}
            </p>
            <p>
              <span className="font-semibold text-[#2E00AB]">Plan:</span> {order.selectedPlanLabel}
            </p>
            <p>
              <span className="font-semibold text-[#2E00AB]">Status:</span> {statusLabel}
            </p>
            <div className="mt-2 space-y-1 border-t border-[#EEE9FF] pt-3">
              <p className="flex justify-between">
                <span className="font-semibold text-[#2E00AB]">Subtotal</span>
                <span>{formatUsd(order.subtotal)}</span>
              </p>
              {order.consultation > 0 ? (
                <p className="flex justify-between">
                  <span>Consultation fee</span>
                  <span>{formatUsd(order.consultation)}</span>
                </p>
              ) : null}
              <p className="flex justify-between">
                <span>Shipping</span>
                <span>{order.shipping > 0 ? formatUsd(order.shipping) : "Free"}</span>
              </p>
              {order.discounts !== null ? (
                order.discounts.map((d) => (
                  <p key={d.label} className="flex justify-between text-emerald-700">
                    <span>{d.label}</span>
                    <span>-{formatUsd(d.amount)}</span>
                  </p>
                ))
              ) : order.promoSavings > 0 ? (
                <p className="flex justify-between text-emerald-700">
                  <span>Promotional savings</span>
                  <span>-{formatUsd(order.promoSavings)}</span>
                </p>
              ) : null}
              {walletApplied > 0 ? (
                <p className="flex justify-between text-emerald-700">
                  <span>Wallet credit applied</span>
                  <span>-{formatUsd(walletApplied)}</span>
                </p>
              ) : null}
              <p className="flex justify-between border-t border-[#EEE9FF] pt-2 text-base">
                <span className="font-semibold text-[#2E00AB]">
                  {isPaid ? "Total Paid" : "Total Due"}
                </span>
                <span className="font-semibold text-[#2E00AB]">{formatUsd(totalPaid)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/shop"
              className="rounded-md border border-[#2E00AB]/30 px-4 py-2 text-sm font-medium text-[#2E00AB]"
            >
              Back to Shop
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md bg-[#2E00AB] px-4 py-2 text-sm font-medium text-white"
            >
              Go to Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Unable to load confirmation."}
        </div>
      </main>
    );
  }
}
