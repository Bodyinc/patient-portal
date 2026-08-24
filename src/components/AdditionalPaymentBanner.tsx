"use client";

import Link from "next/link";

export type AdditionalPaymentBannerItem = {
  requestId: string;
  orderNumber: string;
  medicineName: string;
  amountCents: number;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100,
  );
}

export default function AdditionalPaymentBanner({
  payments,
}: {
  payments: AdditionalPaymentBannerItem[];
}) {
  if (payments.length === 0) return null;

  return (
    <section className="space-y-3">
      {payments.map((payment) => (
        <div
          key={payment.requestId}
          className="flex flex-col gap-3 rounded-[16px] border border-[#E8D48A] bg-[#FFF6D6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#152A51]">Additional payment required</p>
            <p className="mt-1 text-sm text-[#786C46]">
              {money(payment.amountCents)} due to continue{" "}
              <span className="font-medium text-[#152A51]">{payment.medicineName}</span>
              {payment.orderNumber ? (
                <span className="text-[#152A51]/60"> · {payment.orderNumber}</span>
              ) : null}
            </p>
          </div>
          <Link
            href={`/orders/${payment.requestId}/pay`}
            className="inline-flex h-[42px] w-full shrink-0 items-center justify-center rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90 sm:w-auto"
          >
            Pay now
          </Link>
        </div>
      ))}
    </section>
  );
}
