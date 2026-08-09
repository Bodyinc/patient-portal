"use client";

import { useEffect } from "react";
import Link from "next/link";

import { formatPortalDate } from "@/lib/date-format";

export type PrescriptionView = {
  id: string;
  medicineName: string;
  directions: string | null;
  createdAt: string;
  patientName: string;
  providerName: string | null;
};

export default function PrescriptionDocument({
  prescription,
  autoPrint,
}: {
  prescription: PrescriptionView;
  autoPrint?: boolean;
}) {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  const date = formatPortalDate(prescription.createdAt);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/my-meds" className="text-sm font-medium text-[#152A51] hover:opacity-80">
          ← Back to My Meds
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[#152A51] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152A51]/90"
        >
          Download / Print
        </button>
      </div>

      <div className="rounded-xl border border-[#E8EEED] bg-white p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-[#E8EEED] pb-4">
          <div>
            <div className="text-lg font-bold text-[#152A51]">Body Inc</div>
            <div className="text-xs uppercase tracking-wide text-[#152A51]/60">Prescription</div>
          </div>
          <div className="text-right text-xs text-[#152A51]/70">
            <div>Date: {date}</div>
            <div className="font-mono">Rx: {prescription.id.slice(0, 8)}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-medium uppercase text-[#152A51]/50">Patient</div>
            <div className="text-[#152A51]">{prescription.patientName}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-[#152A51]/50">
              Prescribing provider
            </div>
            <div className="text-[#152A51]">{prescription.providerName ?? "—"}</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs font-medium uppercase text-[#152A51]/50">Medication</div>
          <div className="text-lg font-semibold text-[#152A51]">{prescription.medicineName}</div>
          {prescription.directions ? (
            <div className="mt-1 text-sm text-[#152A51]/80">{prescription.directions}</div>
          ) : null}
        </div>

        <div className="mt-10 border-t border-[#E8EEED] pt-4 text-xs text-[#152A51]/50">
          This prescription was generated electronically by Body Inc.
        </div>
      </div>
    </div>
  );
}
