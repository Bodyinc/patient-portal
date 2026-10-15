"use client";

import type { ReactNode } from "react";

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
  consultationFeeCents?: number;
  renewalShippingCents?: number;
  onPromoCodeChange: (value: string) => void;
  onApplyPromo: () => void;
};

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  );
}

function WaivedFee({ cents }: { cents: number }) {
  return (
    <>
      {cents > 0 ? (
        <span className="text-[#152A51]/45 line-through">{formatMoney(cents / 100)}</span>
      ) : null}
      <span className="font-medium text-[#34845F]">FREE</span>
    </>
  );
}

export default function OrderSummary({
  medicationName,
  planLabel,
  medicationTotal,
  medicationOriginalTotal,
  discount,
  discountLabel,
  total,
  promoCode,
  promoMessage,
  promoError,
  applyingPromo,
  loading = false,
  consultationFeeCents = 0,
  renewalShippingCents = 0,
  onPromoCodeChange,
  onApplyPromo,
}: OrderSummaryProps) {
  const planSavings = Math.max(0, medicationOriginalTotal - medicationTotal);
  const showOriginal = planSavings > 0 || discount > 0;
  const youSave = planSavings + discount + (consultationFeeCents + renewalShippingCents) / 100;

  return (
    <div className="h-fit w-full rounded-[14px] border border-[#E8E8E8] bg-white p-4 onboarding-font sm:p-5">
      <h2 className="border-b border-[#E8E8E8] pb-3 text-[16px] font-medium text-[#152A51] sm:text-[18px]">
        Order Summary
      </h2>

      <div className="py-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-[#152A51]">{medicationName}</p>
          <p className="truncate text-[12px] text-[#152A51]/70">{planLabel}</p>
        </div>

        <div className="mt-4 space-y-2 border-t border-[#E8E8E8] pt-4 text-[14px] text-[#152A51]">
          {loading ? (
            <SummaryRow label="Original price">—</SummaryRow>
          ) : showOriginal ? (
            <SummaryRow label="Original price">{formatMoney(medicationOriginalTotal)}</SummaryRow>
          ) : null}

          {!loading && planSavings > 0 ? (
            <SummaryRow label="Discount">
              <span className="font-medium text-[#34845F]">-{formatMoney(planSavings)}</span>
            </SummaryRow>
          ) : null}

          {!loading && discount > 0 ? (
            <SummaryRow label={discountLabel ? `Promo (${discountLabel})` : "Promo"}>
              <span className="font-medium text-[#34845F]">-{formatMoney(discount)}</span>
            </SummaryRow>
          ) : null}

          <SummaryRow label="Consultation fee">
            <WaivedFee cents={consultationFeeCents} />
          </SummaryRow>
          <SummaryRow label="Shipping">
            <WaivedFee cents={renewalShippingCents} />
          </SummaryRow>
          <SummaryRow label="Tax">$0.00</SummaryRow>
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
            {!loading && youSave > 0 ? (
              <p className="mt-1 text-[12px] font-medium text-[#34845F]">
                You save {formatMoney(youSave)}
              </p>
            ) : null}
          </div>
          <p className="text-[22px] font-medium tracking-[-0.5px] text-[#152A51] sm:text-[24px]">
            {loading ? "—" : formatMoney(total)}
          </p>
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
