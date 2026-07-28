"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MyMedsMedicationRequestDto, MyMedsMedicationRequestsListDto } from "./types";

type MedicationRequestsSectionProps = {
  requests: MyMedsMedicationRequestsListDto;
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

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100,
  );
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "delivered":
      return "bg-[#E0FAE8] text-[#34845F]";
    case "awaiting_additional_payment":
      return "bg-[#FFF6D6] text-[#786C46]";
    case "rejected":
    case "cancelled":
      return "bg-red-50 text-red-700";
    default:
      return "bg-[#E8EEED] text-[#152A51]";
  }
}

export default function MedicationRequestsSection({
  requests,
  isPending = false,
  onChangePage,
}: MedicationRequestsSectionProps) {
  const { items, page, totalPages, total, pageSize } = requests;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const [active, setActive] = useState<MyMedsMedicationRequestDto | null>(null);

  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
          Medication Requests
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#E8EEED] bg-[#F3F6F6] px-4 py-8 text-center">
          <p className="text-sm text-[#152A51]/70">
            {requests.query ? "No requests match your search." : "No medication requests yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E8EEED] hover:bg-transparent">
                <TableHead className="min-w-[160px] text-[#152A51]/70">Medicine</TableHead>
                <TableHead className="min-w-[140px] text-[#152A51]/70">Plan</TableHead>
                <TableHead className="min-w-[130px] text-[#152A51]/70">Status</TableHead>
                <TableHead className="min-w-[120px] text-right text-[#152A51]/70">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((request) => (
                <TableRow key={request.id} className="border-[#E8EEED] hover:bg-[#F3F6F6]/60">
                  <TableCell className="text-sm font-medium text-[#152A51]">
                    {request.medicationName}
                  </TableCell>
                  <TableCell className="text-sm text-[#152A51]/80">
                    {request.planName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                        request.status,
                      )}`}
                    >
                      {request.statusLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => setActive(request)}
                      className="rounded-full border border-[#152A51] px-3 py-1.5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6]"
                    >
                      Track request
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#152A51]/70">
            Showing {start}-{end} of {total} request{total === 1 ? "" : "s"}
          </p>

          <div className="flex items-center gap-2">
            {page > 1 ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onChangePage(page - 1)}
                className="rounded-full border border-[#E8EEED] px-4 py-1.5 text-sm text-[#152A51] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
            ) : (
              <span className="rounded-full border border-[#E8EEED] px-4 py-1.5 text-sm text-[#152A51]/40">
                Previous
              </span>
            )}

            {page < totalPages ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onChangePage(page + 1)}
                className="rounded-full bg-[#152A51] px-4 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            ) : (
              <span className="rounded-full border border-[#E8EEED] px-4 py-1.5 text-sm text-[#152A51]/40">
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#152A51]">
              {active?.medicationName}
              {active?.planName ? (
                <span className="block text-sm font-normal text-[#152A51]/60">
                  {active.planName}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          {active ? (
            active.isRejected ? (
              <p className="rounded-[14px] bg-red-50 p-3 text-sm text-red-700">
                This order was rejected and the payment refunded.
              </p>
            ) : (
              <div className="pt-1">
                {active.pendingPaymentCents ? (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-[14px] border border-[#E8EEED] bg-[#FFF6D6] p-3">
                    <span className="text-sm text-[#786C46]">
                      {money(active.pendingPaymentCents)} due to continue
                    </span>
                    <Link
                      href={`/orders/${active.id}/pay`}
                      className="rounded-full bg-[#152A51] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#152A51]/90"
                    >
                      Pay now
                    </Link>
                  </div>
                ) : null}

                <ol>
                  {active.timeline.map((step, i) => {
                    const isLast = i === active.timeline.length - 1;
                    return (
                      <li key={step.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                              step.state === "done"
                                ? "border-[#6A9B9C] bg-[#6A9B9C]"
                                : step.state === "current"
                                  ? "border-[#152A51] bg-white ring-4 ring-[#152A51]/15"
                                  : "border-[#E8EEED] bg-white"
                            }`}
                          />
                          {!isLast ? (
                            <span
                              className={`w-0.5 grow ${
                                step.state === "done" ? "bg-[#6A9B9C]" : "bg-[#E8EEED]"
                              }`}
                              style={{ minHeight: "28px" }}
                            />
                          ) : null}
                        </div>
                        <div className="pb-6">
                          <div
                            className={`text-sm ${
                              step.state === "upcoming"
                                ? "text-[#152A51]/40"
                                : "font-medium text-[#152A51]"
                            }`}
                          >
                            {step.label}
                          </div>
                          {step.at ? (
                            <div className="text-xs text-[#152A51]/50">{formatDate(step.at)}</div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {active.trackingNumber ? (
                  <p className="mt-1 text-sm text-[#152A51]">
                    <span className="text-[#152A51]/60">Tracking #:</span> {active.trackingNumber}
                  </p>
                ) : null}

                {active.prescription ? (
                  <div className="mt-3 rounded-[14px] border border-[#E8EEED] bg-[#F3F6F6] p-3">
                    <div className="text-sm font-medium text-[#152A51]">Prescription</div>
                    <div className="text-sm text-[#152A51]/80">
                      {active.prescription.medicineName}
                    </div>
                    {active.prescription.directions ? (
                      <div className="text-xs text-[#152A51]/70">
                        {active.prescription.directions}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/prescriptions/${active.prescription.id}`}
                        target="_blank"
                        className="rounded-full border border-[#152A51] px-3 py-1.5 text-sm font-medium text-[#152A51] hover:bg-white"
                      >
                        View
                      </Link>
                      <Link
                        href={`/prescriptions/${active.prescription.id}?download=1`}
                        target="_blank"
                        className="rounded-full bg-[#152A51] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#152A51]/90"
                      >
                        Download
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
