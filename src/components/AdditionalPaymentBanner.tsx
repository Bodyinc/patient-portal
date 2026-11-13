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

export function MedicineChangeConsentBanner({
  consents,
}: {
  consents: Array<{
    requestId: string;
    orderNumber: string;
    medicineName: string;
    creditCents: number;
  }>;
}) {
  if (consents.length === 0) return null;

  return (
    <section className="space-y-3">
      {consents.map((change) => (
        <div
          key={change.requestId}
          className="flex flex-col gap-3 rounded-[16px] border border-[#E8D48A] bg-[#FFF6D6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#152A51]">Approve or reject this change</p>
            <p className="mt-1 text-sm text-[#786C46]">
              Nothing extra is due for{" "}
              <span className="font-medium text-[#152A51]">{change.medicineName}</span>
              {change.orderNumber ? (
                <span className="text-[#152A51]/60"> · {change.orderNumber}</span>
              ) : null}
              {change.creditCents > 0
                ? `. Approving applies a ${money(change.creditCents)} credit on your next bill.`
                : ". Approving sends the updated order to the pharmacy."}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href={`/orders/${change.requestId}?action=approve`}
              className="inline-flex h-[42px] items-center justify-center rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90"
            >
              Approve
            </Link>
            <Link
              href={`/orders/${change.requestId}?action=reject`}
              className="inline-flex h-[42px] items-center justify-center rounded-full border border-[#152A51] bg-white px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6]"
            >
              Reject
            </Link>
          </div>
        </div>
      ))}
    </section>
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
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href={`/orders/${payment.requestId}/pay`}
              className="inline-flex h-[42px] items-center justify-center rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90"
            >
              Pay now
            </Link>
            <Link
              href={`/orders/${payment.requestId}?action=decline`}
              className="inline-flex h-[42px] items-center justify-center rounded-full border border-[#152A51] bg-white px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6]"
            >
              Decline
            </Link>
          </div>
        </div>
      ))}
    </section>
  );
}
