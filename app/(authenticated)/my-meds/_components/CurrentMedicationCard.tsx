"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { MyMedsCurrentMedicationDto } from "./types";

type CurrentMedicationCardProps = {
  medication: MyMedsCurrentMedicationDto | null;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function CurrentMedicationCard({ medication }: CurrentMedicationCardProps) {
  function handleRefillRequest() {
    window.alert("Refill requests are coming soon.");
  }

  if (!medication) {
    return (
      <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
        <h2 className="mb-4 text-xl font-semibold text-[#2E00AB]">Current Medication Requests</h2>
        <div className="rounded-md border border-dashed border-[#E6DEFF] bg-[#FAF8FF] px-4 py-8 text-center">
          <p className="text-sm text-[#2E00AB]/70">No active medication requests.</p>
          <Link
            href="/shop"
            className="mt-3 inline-flex rounded-md bg-[#2E00AB] px-4 py-2 text-sm font-medium text-white hover:bg-[#2E00AB]/90"
          >
            Browse Shop
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <h2 className="mb-4 text-xl font-semibold text-[#2E00AB]">Current Medication Requests</h2>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-[#2E00AB]/60">Medication Name</p>
            <p className="mt-1 text-sm font-medium text-[#2E00AB]">{medication.medicationName}</p>
          </div>
          <div>
            <p className="text-xs text-[#2E00AB]/60">Current Plan</p>
            <p className="mt-1 text-sm font-medium text-[#2E00AB]">{medication.currentPlan}</p>
          </div>
          <div>
            <p className="text-xs text-[#2E00AB]/60">Quantity / Supply</p>
            <p className="mt-1 text-sm font-medium text-[#2E00AB]">{medication.quantitySupply}</p>
          </div>
          <div>
            <p className="text-xs text-[#2E00AB]/60">Next Refill Date</p>
            <p className="mt-1 text-sm font-medium text-[#2E00AB]">
              {formatDate(medication.nextRefillDate)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefillRequest}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#2E00AB] px-4 py-2 text-sm font-medium text-[#2E00AB] hover:bg-[#F6F3FF] sm:w-auto"
        >
          New Refill Request
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
