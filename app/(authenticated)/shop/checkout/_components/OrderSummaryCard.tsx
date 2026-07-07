type OrderSummaryCardProps = {
  subtotal: number;
  promoSavings: number;
  total: number;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { 
    style: "currency", 
    currency: "USD",
    minimumFractionDigits: 2 
  }).format(value);
}

export default function OrderSummaryCard({ subtotal, promoSavings, total }: OrderSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-[#E6DEFF] bg-white p-6">
      <h3 className="text-xl font-semibold text-[#2E00AB]">Order Summary</h3>

      <div className="mt-6 space-y-4 text-base">
        <div className="flex justify-between pb-3 border-b border-[#EFE9FF]">
          <span className="text-[#2E00AB]/80">Subtotal</span>
          <span className="font-medium">{formatUsd(subtotal)}</span>
        </div>
        <div className="flex justify-between pb-3 border-b border-[#EFE9FF]">
          <span className="text-[#2E00AB]/80">Shipping</span>
          <span className="font-medium">Free</span>
        </div>
        {promoSavings > 0 && (
          <div className="flex justify-between pb-3 border-b border-[#EFE9FF]">
            <span className="text-[#2E00AB]/80">Promotional Savings</span>
            <span className="font-medium text-green-600">-{formatUsd(promoSavings)}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <span className="text-lg font-semibold text-[#2E00AB]">Total Amount</span>
        <span className="text-2xl font-semibold text-[#2E00AB]">{formatUsd(total)}</span>
      </div>
    </section>
  );
}