type OrderSummaryCardProps = {
  subtotal: number;
  processingFee: number;
  promoSavings: number;
  total: number;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function OrderSummaryCard({
  subtotal,
  processingFee,
  promoSavings,
  total,
}: OrderSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-[#E6DEFF] bg-white p-4">
      <h3 className="text-2xl font-semibold text-[#2E00AB]">Order Summary</h3>
      <div className="mt-4 space-y-3 text-sm text-[#2E00AB]/80">
        <div className="flex items-center justify-between border-b border-[#EFE9FF] pb-2">
          <span>Subtotal</span>
          <span>{formatUsd(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#EFE9FF] pb-2">
          <span>Shipping</span>
          <span>Free</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#EFE9FF] pb-2">
          <span>Processing Fee</span>
          <span>{formatUsd(processingFee)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#EFE9FF] pb-2">
          <span>Promotional Savings</span>
          <span>{promoSavings > 0 ? `-${formatUsd(promoSavings)}` : formatUsd(0)}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-semibold text-[#2E00AB]">Total Amount</span>
        <span className="text-4xl font-semibold text-[#2E00AB]">{formatUsd(total)}</span>
      </div>
    </section>
  );
}
