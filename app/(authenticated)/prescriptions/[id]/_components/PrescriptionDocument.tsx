"use client";

import { useEffect } from "react";
import Link from "next/link";

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

  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(prescription.createdAt));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/my-meds" className="text-sm font-medium text-[#2E00AB] hover:opacity-80">
          ← Back to My Meds
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[#2E00AB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E00AB]/90"
        >
          Download / Print
        </button>
      </div>

      <div className="rounded-xl border border-[#E6DEFF] bg-white p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-[#E6DEFF] pb-4">
          <div>
            <div className="text-lg font-bold text-[#2E00AB]">Body Inc</div>
            <div className="text-xs uppercase tracking-wide text-[#2E00AB]/60">Prescription</div>
          </div>
          <div className="text-right text-xs text-[#2E00AB]/70">
            <div>Date: {date}</div>
            <div className="font-mono">Rx: {prescription.id.slice(0, 8)}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-medium uppercase text-[#2E00AB]/50">Patient</div>
            <div className="text-[#2E00AB]">{prescription.patientName}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-[#2E00AB]/50">
              Prescribing provider
            </div>
            <div className="text-[#2E00AB]">{prescription.providerName ?? "—"}</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs font-medium uppercase text-[#2E00AB]/50">Medication</div>
          <div className="text-lg font-semibold text-[#2E00AB]">{prescription.medicineName}</div>
          {prescription.directions ? (
            <div className="mt-1 text-sm text-[#2E00AB]/80">{prescription.directions}</div>
          ) : null}
        </div>

        <div className="mt-10 border-t border-[#E6DEFF] pt-4 text-xs text-[#2E00AB]/50">
          This prescription was generated electronically by Body Inc.
        </div>
      </div>
    </div>
  );
}
