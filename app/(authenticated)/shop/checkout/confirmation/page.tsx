import Link from "next/link";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { getShopCheckoutOrderByIdData } from "@/lib/shop/service-data";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function ShopCheckoutConfirmationPage({
  searchParams,
}: {
  searchParams?: Promise<{ orderId?: string }>;
}) {
  const { user } = await requirePatientSession();
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

    return (
      <main className="min-w-0 flex-1 bg-[#FAF8FF] p-4">
        <section className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-[#E6DEFF] bg-white p-6">
          <h1 className="text-3xl font-semibold text-[#2E00AB]">Order Created</h1>
          <p className="text-sm text-[#2E00AB]/75">
            Your order has been created and is currently in{" "}
            <span className="font-semibold">{order.status}</span> state.
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
              <span className="font-semibold text-[#2E00AB]">Subtotal:</span>{" "}
              {formatUsd(order.subtotal)}
            </p>
            <p>
              <span className="font-semibold text-[#2E00AB]">Savings:</span>{" "}
              {`-${formatUsd(order.promoSavings)}`}
            </p>
            <p>
              <span className="font-semibold text-[#2E00AB]">Total:</span> {formatUsd(order.total)}
            </p>
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
