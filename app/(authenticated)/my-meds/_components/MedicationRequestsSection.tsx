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
      return "bg-emerald-50 text-emerald-700";
    case "awaiting_additional_payment":
      return "bg-amber-50 text-amber-700";
    case "rejected":
    case "cancelled":
      return "bg-red-50 text-red-700";
    default:
      return "bg-[#EDE7FF] text-[#2E00AB]";
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
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#2E00AB]">Medication Requests</h2>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#E6DEFF] bg-[#FAF8FF] px-4 py-8 text-center">
          <p className="text-sm text-[#2E00AB]/70">
            {requests.query ? "No requests match your search." : "No medication requests yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#EEE9FF] hover:bg-transparent">
                <TableHead className="min-w-[160px] text-[#2E00AB]/70">Medicine</TableHead>
                <TableHead className="min-w-[140px] text-[#2E00AB]/70">Plan</TableHead>
                <TableHead className="min-w-[130px] text-[#2E00AB]/70">Status</TableHead>
                <TableHead className="min-w-[120px] text-right text-[#2E00AB]/70">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((request) => (
                <TableRow key={request.id} className="border-[#EEE9FF] hover:bg-[#FAF8FF]/60">
                  <TableCell className="text-sm font-medium text-[#2E00AB]">
                    {request.medicationName}
                  </TableCell>
                  <TableCell className="text-sm text-[#2E00AB]/80">
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
                      className="rounded-md border border-[#2E00AB] px-3 py-1.5 text-sm font-medium text-[#2E00AB] hover:bg-[#F6F3FF]"
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
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#2E00AB]/70">
            Showing {start}-{end} of {total} request{total === 1 ? "" : "s"}
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

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2E00AB]">
              {active?.medicationName}
              {active?.planName ? (
                <span className="block text-sm font-normal text-[#2E00AB]/60">
                  {active.planName}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          {active ? (
            active.isRejected ? (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                This order was rejected and the payment refunded.
              </p>
            ) : (
              <div className="pt-1">
                {active.pendingPaymentCents ? (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <span className="text-sm text-amber-800">
                      {money(active.pendingPaymentCents)} due to continue
                    </span>
                    <Link
                      href={`/orders/${active.id}/pay`}
                      className="rounded-md bg-[#2E00AB] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2E00AB]/90"
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
                                ? "border-[#2E00AB] bg-[#2E00AB]"
                                : step.state === "current"
                                  ? "border-[#2E00AB] bg-white ring-4 ring-[#2E00AB]/15"
                                  : "border-[#D9CEFF] bg-white"
                            }`}
                          />
                          {!isLast ? (
                            <span
                              className={`w-0.5 grow ${
                                step.state === "done" ? "bg-[#2E00AB]" : "bg-[#E6DEFF]"
                              }`}
                              style={{ minHeight: "28px" }}
                            />
                          ) : null}
                        </div>
                        <div className="pb-6">
                          <div
                            className={`text-sm ${
                              step.state === "upcoming"
                                ? "text-[#2E00AB]/40"
                                : "font-medium text-[#2E00AB]"
                            }`}
                          >
                            {step.label}
                          </div>
                          {step.at ? (
                            <div className="text-xs text-[#2E00AB]/50">{formatDate(step.at)}</div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {active.trackingNumber ? (
                  <p className="mt-1 text-sm text-[#2E00AB]">
                    <span className="text-[#2E00AB]/60">Tracking #:</span> {active.trackingNumber}
                  </p>
                ) : null}

                {active.prescription ? (
                  <div className="mt-3 rounded-lg border border-[#E6DEFF] bg-[#FAF8FF] p-3">
                    <div className="text-sm font-semibold text-[#2E00AB]">Prescription</div>
                    <div className="text-sm text-[#2E00AB]/80">
                      {active.prescription.medicineName}
                    </div>
                    {active.prescription.directions ? (
                      <div className="text-xs text-[#2E00AB]/70">
                        {active.prescription.directions}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/prescriptions/${active.prescription.id}`}
                        target="_blank"
                        className="rounded-md border border-[#2E00AB] px-3 py-1.5 text-sm font-medium text-[#2E00AB] hover:bg-[#F6F3FF]"
                      >
                        View
                      </Link>
                      <Link
                        href={`/prescriptions/${active.prescription.id}?download=1`}
                        target="_blank"
                        className="rounded-md bg-[#2E00AB] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#2E00AB]/90"
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
