"use client";

import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import type { ConfirmationData } from "../types";

type OrderSummaryProps = {
  data: ConfirmationData | null;
  loaded: boolean;
};

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-[#152A51]/70">{label}</span>
      <span className="flex items-center gap-2 text-right font-medium text-[#152A51]">
        {children}
      </span>
    </div>
  );
}

function WaivedFee({ cents }: { cents: number }) {
  return (
    <>
      {cents > 0 ? (
        <span className="font-normal text-[#152A51]/45 line-through">
          {formatMoney(cents / 100)}
        </span>
      ) : null}
      <span className="font-semibold text-[#34845F]">FREE</span>
    </>
  );
}

export default function OrderSummary({ data, loaded }: OrderSummaryProps) {
  const medicationName = data?.medicineName?.trim() || "Selected Medication";
  const variantName = data?.variantName?.trim() || null;
  const planLabel = data?.packageName?.trim() || "Treatment Plan";
  const sale = data?.packagePrice ?? data?.totalPaid ?? null;
  const original =
    data?.packageOriginalPrice != null && sale != null && data.packageOriginalPrice > sale
      ? data.packageOriginalPrice
      : sale;
  const planSavings = original != null && sale != null ? Math.max(0, original - sale) : 0;
  const promo = sale != null && data?.totalPaid != null ? Math.max(0, sale - data.totalPaid) : 0;
  const total = data?.totalPaid ?? sale;
  const consultationFeeCents = data?.consultationFeeCents ?? 0;
  const renewalShippingCents = data?.renewalShippingCents ?? 0;
  const youSave = planSavings + promo + (consultationFeeCents + renewalShippingCents) / 100;
  const showOriginal = planSavings > 0 || promo > 0;

  return (
    <Card className="h-fit w-full overflow-hidden rounded-2xl border border-[#152A51]/20 bg-white shadow-none">
      <div className="bg-[#E8EEED] px-5 py-3.5">
        <h2 className="text-base font-semibold text-[#152A51] sm:text-lg">Order Summary</h2>
      </div>

      <div className="p-5">
        <div className="pb-3">
          {(data?.items?.length ?? 0) > 1 ? (
            <ul className="space-y-3">
              {data?.items.map((item) => (
                <li key={`${item.name}-${item.planLabel}`}>
                  <p className="text-sm font-medium text-[#152A51]">{item.name}</p>
                  <p className="mt-0.5 text-sm text-[#152A51]/70">
                    {item.planLabel}
                    {item.price != null ? ` · ${formatMoney(item.price)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-sm font-medium text-[#152A51]">{medicationName}</p>
              <p className="mt-0.5 text-sm text-[#152A51]/70">
                {variantName ? `${variantName} · ${planLabel}` : planLabel}
              </p>
            </>
          )}
        </div>

        <div className="border-t border-[#152A51]/10">
          {!loaded ? (
            <SummaryRow label="Original price">—</SummaryRow>
          ) : showOriginal && original != null ? (
            <SummaryRow label="Original price">{formatMoney(original)}</SummaryRow>
          ) : null}

          {loaded && planSavings > 0 ? (
            <SummaryRow label="Discount">
              <span className="font-semibold text-[#34845F]">-{formatMoney(planSavings)}</span>
            </SummaryRow>
          ) : null}

          {loaded && promo > 0 ? (
            <SummaryRow label="Promo">
              <span className="font-semibold text-[#34845F]">-{formatMoney(promo)}</span>
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

        {renewalShippingCents > 0 ? (
          <p className="mt-3 rounded-xl bg-[#E8EEED]/80 px-3.5 py-3 text-[12px] leading-relaxed text-[#152A51]/75">
            This first payment covers medication only — consultation and shipping are free. Starting
            with your next renewal, a {formatMoney(renewalShippingCents / 100)} shipping fee will be
            added to each automatic payment.
          </p>
        ) : null}

        <div className="mt-4 flex items-end justify-between border-t border-[#152A51]/10 pt-4">
          <div>
            <p className="text-base font-semibold text-[#152A51]">Total Paid</p>
            {loaded && youSave > 0 ? (
              <p className="mt-1 text-[12px] font-medium text-[#34845F]">
                You save {formatMoney(youSave)}
              </p>
            ) : null}
          </div>
          <p className="text-[28px] font-semibold tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
            {loaded && total != null ? formatMoney(total) : loaded ? "—" : "…"}
          </p>
        </div>
      </div>
    </Card>
  );
}
