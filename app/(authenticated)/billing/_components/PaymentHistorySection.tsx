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

type PaymentHistorySectionProps = {
  payments: BillingPaymentsListDto;
  isPending?: boolean;
  onChangePage: (page: number) => void;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <h2 className="mb-4 text-xl font-semibold text-[#2E00AB]">Payment History</h2>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#E6DEFF] bg-[#FAF8FF] px-4 py-8 text-center">
          <p className="text-sm text-[#2E00AB]/70">
            {payments.query ? "No transactions match your search." : "No payment history yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#EEE9FF] hover:bg-transparent">
                <TableHead className="min-w-[100px] text-[#2E00AB]/70">Date</TableHead>
                <TableHead className="min-w-[160px] text-[#2E00AB]/70">Description</TableHead>
                <TableHead className="hidden min-w-[140px] text-[#2E00AB]/70 md:table-cell">
                  Subscription
                </TableHead>
                <TableHead className="min-w-[90px] text-[#2E00AB]/70">Amount</TableHead>
                <TableHead className="hidden min-w-[130px] text-[#2E00AB]/70 lg:table-cell">
                  Payment Method
                </TableHead>
                <TableHead className="min-w-[80px] text-[#2E00AB]/70">Status</TableHead>
                <TableHead className="min-w-[80px] text-right text-[#2E00AB]/70">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((payment) => (
                <TableRow key={payment.id} className="border-[#EEE9FF] hover:bg-[#FAF8FF]/60">
                  <TableCell className="text-sm text-[#2E00AB]">
                    {formatDate(payment.date)}
                  </TableCell>
                  <TableCell className="text-sm text-[#2E00AB]/80">{payment.description}</TableCell>
                  <TableCell className="hidden text-sm text-[#2E00AB]/80 md:table-cell">
                    {payment.subscriptionName}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-[#2E00AB]">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-[#2E00AB]/80 lg:table-cell">
                    {payment.paymentMethod}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-[#EDE7FF] px-2.5 py-1 text-xs font-medium text-[#2E00AB]">
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
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D5CAFF] text-[#2E00AB] hover:bg-[#F6F3FF]"
                          aria-label="View invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#EEE9FF] text-[#2E00AB]/30"
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
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D5CAFF] text-[#2E00AB] hover:bg-[#F6F3FF]"
                          aria-label="Download invoice"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#EEE9FF] text-[#2E00AB]/30"
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
          <p className="text-sm text-[#2E00AB]/70">
            Showing {start}-{end} of {total} transaction{total === 1 ? "" : "s"}
          </p>

          <div className="flex items-center gap-2">
            {page > 1 ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onChangePage(page - 1)}
                className="rounded-md border border-[#D5CAFF] px-3 py-1.5 text-sm text-[#2E00AB] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
            ) : (
              <span className="rounded-md border border-[#EEE9FF] px-3 py-1.5 text-sm text-[#2E00AB]/40">
                Previous
              </span>
            )}

            {page < totalPages ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onChangePage(page + 1)}
                className="rounded-md border border-[#2E00AB] bg-[#2E00AB] px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            ) : (
              <span className="rounded-md border border-[#EEE9FF] px-3 py-1.5 text-sm text-[#2E00AB]/40">
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
