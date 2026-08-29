"use client";

import { Download, Eye } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BillingPaymentsListDto } from "./types";
import { formatPortalDate } from "@/lib/date-format";

type PaymentHistorySectionProps = {
  payments: BillingPaymentsListDto;
  isPending?: boolean;
  onChangePage: (page: number) => void;
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

export default function PaymentHistorySection({
  payments,
  isPending = false,
  onChangePage,
}: PaymentHistorySectionProps) {
  const { items, page, totalPages, total, pageSize } = payments;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section className="rounded-md border border-[#E8EEED] bg-white p-4">
      <h2 className="mb-4 text-xl font-semibold text-[#152A51]">Payment History</h2>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#E8EEED] bg-[#F3F6F6] px-4 py-8 text-center">
          <p className="text-sm text-[#152A51]/70">
            {payments.query ? "No transactions match your search." : "No payment history yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E8EEED] hover:bg-transparent">
                <TableHead className="min-w-[110px] text-[#152A51]/70">Order</TableHead>
                <TableHead className="min-w-[100px] text-[#152A51]/70">Date</TableHead>
                <TableHead className="min-w-[160px] text-[#152A51]/70">Description</TableHead>
                <TableHead className="hidden min-w-[100px] text-[#152A51]/70 sm:table-cell">
                  Variant
                </TableHead>
                <TableHead className="hidden min-w-[130px] text-[#152A51]/70 md:table-cell">
                  Subscription
                </TableHead>
                <TableHead className="min-w-[90px] text-[#152A51]/70">Amount</TableHead>
                <TableHead className="hidden min-w-[130px] text-[#152A51]/70 lg:table-cell">
                  Payment Method
                </TableHead>
                <TableHead className="min-w-[80px] text-[#152A51]/70">Status</TableHead>
                <TableHead className="min-w-[80px] text-right text-[#152A51]/70">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((payment) => (
                <TableRow key={payment.id} className="border-[#E8EEED] hover:bg-[#F3F6F6]/60">
                  <TableCell className="text-sm font-medium text-[#152A51]">
                    {payment.orderNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-[#152A51]">
                    {formatDate(payment.date)}
                  </TableCell>
                  <TableCell className="text-sm text-[#152A51]/80">{payment.description}</TableCell>
                  <TableCell className="hidden text-sm text-[#152A51]/80 sm:table-cell">
                    {payment.variantName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-sm text-[#152A51]/80 md:table-cell">
                    {payment.planLabel}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-[#152A51]">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-[#152A51]/80 lg:table-cell">
                    {payment.paymentMethod}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-[#E8EEED] px-2.5 py-1 text-xs font-medium text-[#152A51]">
                      {payment.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {payment.invoiceUrl ? (
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D5DFDE] text-[#152A51] hover:bg-[#F3F6F6]"
                          aria-label="View invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E8EEED] text-[#152A51]/30"
                          aria-hidden
                        >
                          <Eye className="h-4 w-4" />
                        </span>
                      )}
                      {payment.invoicePdfUrl ? (
                        <a
                          href={payment.invoicePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D5DFDE] text-[#152A51] hover:bg-[#F3F6F6]"
                          aria-label="Download invoice"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E8EEED] text-[#152A51]/30"
                          aria-hidden
                        >
                          <Download className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#152A51]/70">
            Showing {start}-{end} of {total} transaction{total === 1 ? "" : "s"}
          </p>

          <div className="flex items-center gap-2">
            {page > 1 ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onChangePage(page - 1)}
                className="rounded-md border border-[#D5DFDE] px-3 py-1.5 text-sm text-[#152A51] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
            ) : (
              <span className="rounded-md border border-[#E8EEED] px-3 py-1.5 text-sm text-[#152A51]/40">
                Previous
              </span>
            )}

            {page < totalPages ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onChangePage(page + 1)}
                className="rounded-md border border-[#152A51] bg-[#152A51] px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            ) : (
              <span className="rounded-md border border-[#E8EEED] px-3 py-1.5 text-sm text-[#152A51]/40">
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
