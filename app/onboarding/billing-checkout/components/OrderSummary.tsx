"use client";

import { fieldControlClass } from "../../_lib/onboarding-theme";

type OrderSummaryProps = {
  medicationName: string;
  planLabel: string;
  medicationTotal: number;
  medicationOriginalTotal: number;
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  total: number;
  totalSavings: number;
  promoCode: string;
  promoMessage: string | null;
  promoError: string | null;
  applyingPromo: boolean;
  loading?: boolean;
  renewalShippingCents?: number;
  onPromoCodeChange: (value: string) => void;
  onApplyPromo: () => void;
};

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function PricePair({
  original,
  final,
  finalClassName,
}: {
  original: number;
  final: number;
  finalClassName?: string;
}) {
  if (original <= final) {
    return <span className={finalClassName}>{formatMoney(final)}</span>;
  }

  return (
    <span className="flex items-baseline gap-2">
      <span className="text-[13px] font-normal text-[#152A51]/50 line-through">
        {formatMoney(original)}
      </span>
      <span className={finalClassName}>{formatMoney(final)}</span>
    </span>
  );
}

export default function OrderSummary({
  medicationName,
  planLabel,
  medicationTotal,
  medicationOriginalTotal,
  subtotal,
  discount,
  discountLabel,
  total,
  totalSavings,
  promoCode,
  promoMessage,
  promoError,
  applyingPromo,
  loading = false,
  renewalShippingCents = 0,
  onPromoCodeChange,
  onApplyPromo,
}: OrderSummaryProps) {
  return (
    <div className="h-fit w-full rounded-[14px] border border-[#E8E8E8] bg-white p-4 onboarding-font sm:p-5">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E8E8E8] pb-3">
        <h2 className="text-[16px] font-medium text-[#152A51] sm:text-[18px]">Order Summary</h2>
        {!loading ? (
          <PricePair
            original={medicationOriginalTotal}
            final={medicationTotal}
            finalClassName="text-[18px] font-medium tracking-[-0.5px] text-[#152A51] sm:text-[20px]"
          />
        ) : (
          <span className="text-[18px] font-medium text-[#152A51]">—</span>
        )}
      </div>

      <div className="py-3">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-[#152A51]">{medicationName}</p>
            <p className="truncate text-[12px] text-[#152A51]/70">{planLabel}</p>
          </div>
          <div className="shrink-0 text-right">
            {loading ? (
              <p className="text-[14px] font-medium text-[#152A51]">—</p>
            ) : (
              <p className="text-[14px] font-medium text-[#152A51]">
                {formatMoney(medicationTotal)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-[#E8E8E8] pt-4 text-[14px] text-[#152A51]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{loading ? "—" : formatMoney(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-[#34845F]">
              <span>Discount ({discountLabel ?? "Promo"})</span>
              <span>-{formatMoney(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Consultation fee</span>
            <span className="font-medium text-[#34845F]">FREE</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span className="font-medium text-[#34845F]">FREE</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>$0.00</span>
          </div>
        </div>

        {renewalShippingCents > 0 && (
          <p className="mt-3 rounded-[12px] bg-[#F3F8F8] px-3 py-2 text-[12px] leading-relaxed text-[#152A51]/80">
            Your first payment covers medication only — consultation and shipping are free. Starting
            with your next renewal, a {formatMoney(renewalShippingCents / 100)} shipping fee will be
            added to each automatic payment.
          </p>
        )}

        <div className="mt-5 flex items-end justify-between border-t border-[#E8E8E8] pt-4">
          <div>
            <p className="text-[15px] font-medium text-[#152A51]">Total Due Today</p>
            {!loading && totalSavings > 0 ? (
              <p className="mt-1 text-[12px] font-medium text-[#34845F]">
                Total savings {formatMoney(totalSavings)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            {loading ? (
              <p className="text-[22px] font-medium tracking-[-0.5px] text-[#152A51] sm:text-[24px]">
                —
              </p>
            ) : (
              <p className="text-[22px] font-medium tracking-[-0.5px] text-[#152A51] sm:text-[24px]">
                {formatMoney(total)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={promoCode}
              onChange={(e) => onPromoCodeChange(e.target.value)}
              placeholder="Promo code"
              className={`${fieldControlClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={onApplyPromo}
              disabled={applyingPromo || !promoCode.trim()}
              className="h-[45px] shrink-0 rounded-full border border-[#152A51]/30 px-5 text-[14px] font-medium text-[#152A51] transition hover:bg-[#152A51]/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applyingPromo ? "Applying..." : "Apply"}
            </button>
          </div>
          {promoError && <p className="mt-2 text-[12px] text-red-600">{promoError}</p>}
          {promoMessage && <p className="mt-2 text-[12px] text-[#34845F]">{promoMessage}</p>}
        </div>
      </div>
    </div>
  );
}
