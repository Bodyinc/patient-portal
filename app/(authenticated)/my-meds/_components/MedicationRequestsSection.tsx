"use client";

import { Download, Filter } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MyMedsMedicationRequestsListDto } from "./types";

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

export default function MedicationRequestsSection({
  requests,
  isPending = false,
  onChangePage,
}: MedicationRequestsSectionProps) {
  const { items, page, totalPages, total, pageSize } = requests;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#2E00AB]">Medication Requests</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#D5CAFF] text-[#2E00AB] hover:bg-[#F6F3FF]"
            aria-label="Filter requests"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md border border-[#EEE9FF] text-[#2E00AB]/30"
            aria-label="Download requests"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
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
                <TableHead className="min-w-[140px] text-[#2E00AB]/70">Medication Name</TableHead>
                <TableHead className="min-w-[80px] text-[#2E00AB]/70">Dosage</TableHead>
                <TableHead className="min-w-[110px] text-[#2E00AB]/70">Supply Duration</TableHead>
                <TableHead className="min-w-[100px] text-[#2E00AB]/70">Request Date</TableHead>
                <TableHead className="min-w-[90px] text-[#2E00AB]/70">Status</TableHead>
                <TableHead className="hidden min-w-[130px] text-[#2E00AB]/70 md:table-cell">
                  Tracking Number
                </TableHead>
                <TableHead className="min-w-[100px] text-right text-[#2E00AB]/70">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((request) => (
                <TableRow key={request.id} className="border-[#EEE9FF] hover:bg-[#FAF8FF]/60">
                  <TableCell className="text-sm text-[#2E00AB]">{request.medicationName}</TableCell>
                  <TableCell className="text-sm text-[#2E00AB]/80">{request.dosage}</TableCell>
                  <TableCell className="text-sm text-[#2E00AB]/80">
                    {request.supplyDuration}
                  </TableCell>
                  <TableCell className="text-sm text-[#2E00AB]/80">
                    {formatDate(request.requestDate)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-[#EDE7FF] px-2.5 py-1 text-xs font-medium text-[#2E00AB]">
                      {request.status}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-[#2E00AB]/80 md:table-cell">
                    {request.trackingNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      className="text-sm font-medium text-[#2E00AB] underline underline-offset-2"
                    >
                      View Details
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
    </section>
  );
}
