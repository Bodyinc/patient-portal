"use client";
type OrderSummaryProps = {
  medicationName: string;
  planLabel: string;
  medicationTotal: number;
  subtotal: number;
  processingFee: number;
  discount: number;
  discountLabel: string | null;
  total: number;
  promoCode: string;
  promoMessage: string | null;
  promoError: string | null;
  applyingPromo: boolean;
  consentAccepted: boolean;
  confirming: boolean;
  loading?: boolean;
  hideContinue?: boolean;
  onPromoCodeChange: (value: string) => void;
  onApplyPromo: () => void;
  onContinue: () => void;
};

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export default function OrderSummary({
  medicationName,
  planLabel,
  medicationTotal,
  subtotal,
  processingFee,
  discount,
  discountLabel,
  total,
  promoCode,
  promoMessage,
  promoError,
  applyingPromo,
  consentAccepted,
  confirming,
  loading = false,
  hideContinue = false,
  onPromoCodeChange,
  onApplyPromo,
  onContinue,
}: OrderSummaryProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-2xl border border-[#2E00AB]/20 bg-white p-4">
      {/* Header */}
      <div className="shrink-0 border-b border-[#2E00AB]/10 pb-3">
        <h2 className="text-lg font-semibold text-[#2E00AB]">Order Summary</h2>
      </div>

      {/* Scrollable Content - overflow removed */}
      <div className="flex min-h-0 flex-1 flex-col py-3">
        {/* Medication */}
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#2E00AB]">{medicationName}</p>
            <p className="truncate text-xs text-[#2E00AB]/70">{planLabel}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-[#2E00AB]">
            {loading ? "—" : formatMoney(medicationTotal)}
          </p>
        </div>

        {/* Consultation */}
        <div className="mt-4 flex justify-between gap-3 border-b border-[#2E00AB]/10 pb-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#2E00AB]">Initial Provider Consultation</p>
            <p className="text-xs text-[#2E00AB]/70">Required Clinical Assessment</p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-[#2E00AB]">$35.00</p>
        </div>

        {/* Totals */}
        <div className="mt-4 space-y-2 text-sm text-[#2E00AB]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{loading ? "—" : formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Processing Fee</span>
            <span>{formatMoney(processingFee)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount ({discountLabel ?? "Promo"})</span>
              <span>-{formatMoney(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tax</span>
            <span>$0.00</span>
          </div>
        </div>

        {/* Total */}
        <div className="mt-5 flex items-center justify-between border-t border-[#2E00AB]/10 pt-4">
          <p className="text-base font-semibold text-[#2E00AB]">Total Due Today</p>
          <p className="text-2xl font-bold text-[#2E00AB]">{loading ? "—" : formatMoney(total)}</p>
        </div>

        {/* Promo */}
        <div className="mt-5">
          <div className="flex gap-2">
            <input
              value={promoCode}
              onChange={(e) => onPromoCodeChange(e.target.value)}
              placeholder="Promo code"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[#2E00AB]"
            />
            <button
              type="button"
              onClick={onApplyPromo}
              disabled={applyingPromo || !promoCode.trim()}
              className="rounded-md border border-[#2E00AB] px-4 py-2 text-sm font-medium text-[#2E00AB] transition hover:bg-[#2E00AB]/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applyingPromo ? "Applying..." : "Apply"}
            </button>
          </div>
          {promoError && <p className="mt-2 text-xs text-red-600">{promoError}</p>}
          {promoMessage && <p className="mt-2 text-xs text-emerald-700">{promoMessage}</p>}
        </div>

        {/* Push Footer to Bottom */}
        {!hideContinue && (
          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={onContinue}
              disabled={!consentAccepted || confirming}
              className="w-full rounded-md bg-[#2E00AB] py-3 text-base font-semibold text-white transition hover:bg-[#24008A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirming ? "Processing payment..." : "Continue to Payment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
