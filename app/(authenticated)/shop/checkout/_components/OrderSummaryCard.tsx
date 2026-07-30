type OrderSummaryCardProps = {
  subtotal: number;
  promoSavings: number;
  walletApplied?: number;
  shipping?: number;
  consultation?: number;
  total: number;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function OrderSummaryCard({
  subtotal,
  promoSavings,
  walletApplied = 0,
  shipping = 0,
  consultation = 0,
  total,
}: OrderSummaryCardProps) {
  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <h3 className="text-xl font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
        Order Summary
      </h3>
      <div className="mt-4 space-y-3 text-sm text-[#152A51]/80">
        <div className="flex items-center justify-between border-b border-[#E8EEED] pb-2">
          <span>Subtotal</span>
          <span>{formatUsd(subtotal)}</span>
        </div>
        {consultation > 0 ? (
          <div className="flex items-center justify-between border-b border-[#E8EEED] pb-2">
            <span>Consultation fee</span>
            <span>{formatUsd(consultation)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-b border-[#E8EEED] pb-2">
          <span>Shipping</span>
          <span>{shipping > 0 ? formatUsd(shipping) : "Free"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#E8EEED] pb-2">
          <span>Promotional Savings</span>
          <span>{promoSavings > 0 ? `-${formatUsd(promoSavings)}` : formatUsd(0)}</span>
        </div>
        {walletApplied > 0 ? (
          <div className="flex items-center justify-between border-b border-[#E8EEED] pb-2 text-[#34845F]">
            <span>Wallet Credit</span>
            <span>-{formatUsd(walletApplied)}</span>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[16px] font-medium text-[#152A51] sm:text-lg">Total Amount</span>
        <span className="text-[28px] font-medium tracking-[-0.6px] text-[#152A51] sm:text-[32px]">
          {formatUsd(total)}
        </span>
      </div>
    </section>
  );
}
