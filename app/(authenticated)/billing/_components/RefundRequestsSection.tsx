"use client";

import type { RefundRequestDto } from "@/lib/billing/types";
import { formatPortalDate } from "@/lib/date-format";

type RefundRequestsSectionProps = {
  requests: RefundRequestDto[];
};

function formatDate(value: string): string {
  return formatPortalDate(value);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Declined",
};

export default function RefundRequestsSection({ requests }: RefundRequestsSectionProps) {
  if (requests.length === 0) return null;

  return (
    <section className="rounded-md border border-[#E8EEED] bg-white p-4">
      <h2 className="mb-1 text-xl font-semibold text-[#152A51]">Refund Requests</h2>
      <p className="mb-4 text-sm text-[#152A51]/70">
        Requests are reviewed within 24 hours. You&apos;ll see the outcome here.
      </p>

      <ul className="space-y-3">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex flex-col gap-2 rounded-md border border-[#E8EEED] bg-[#F3F6F6] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#152A51]">
                  {formatCurrency(request.amount)}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[request.status] ?? "bg-[#E8EEED] text-[#152A51]"
                  }`}
                >
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
              </div>
              {request.reason ? (
                <p className="mt-1 truncate text-xs text-[#152A51]/70">Reason: {request.reason}</p>
              ) : null}
              {request.adminNote ? (
                <p className="mt-1 text-xs text-[#152A51]/70">Note: {request.adminNote}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-xs text-[#152A51]/60">
              Requested {formatDate(request.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
