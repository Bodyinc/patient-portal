"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  DEFAULT_MEDICINE_IMAGE,
  isExternalMedicineImage,
  resolveMedicineImageSrc,
} from "@/lib/intake/medicine-image";
import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";
import { cn } from "@/lib/utils";

import type { MyMedsCurrentMedicationDto } from "./types";
import {
  medicineImageFrameClass,
  medicineImageFitClass,
} from "../../../onboarding/_lib/onboarding-theme";

type CurrentMedicationCardProps = {
  medication: MyMedsCurrentMedicationDto | null;
};

/** Figma treatment image: 339 × 354.6 — used as aspect; scales down responsively */
const IMAGE_ASPECT = "339 / 354.6";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toDbImageSrc(imageSrc: string | null | undefined): string | null {
  const resolved = resolveMedicineImageSrc(imageSrc);
  if (!resolved || resolved === DEFAULT_MEDICINE_IMAGE) return null;
  return resolved;
}

export default function CurrentMedicationCard({ medication }: CurrentMedicationCardProps) {
  const router = useRouter();

  function handleRefillRequest() {
    if (!medication?.medicineId) return;
    router.push(
      buildShopCheckoutHref({
        medicineId: medication.medicineId,
        variantId: medication.variantId,
        packageId: medication.packageId,
        from: "my-meds",
      }),
    );
  }

  if (!medication) {
    return (
      <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
          Current Medication Requests
        </h2>
        <div className="rounded-[16px] border border-dashed border-[#E8EEED] bg-[#F3F6F6] px-4 py-8 text-center">
          <p className="text-sm text-[#152A51]/70">No active medication requests.</p>
          <Link
            href="/shop"
            className="mt-4 inline-flex h-[46px] items-center rounded-full bg-[#E3E084] px-6 text-sm font-medium text-[#152A51] hover:bg-[#D9D674]"
          >
            Browse Shop
          </Link>
        </div>
      </section>
    );
  }

  const imageSrc = toDbImageSrc(medication.imageSrc);
  const external = imageSrc ? isExternalMedicineImage(imageSrc) : false;
  const canRefill = Boolean(medication.medicineId);

  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white ">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <div
          className={cn(
            "mx-auto w-full max-w-[280px] shrink-0 sm:mx-0 sm:max-w-[300px] lg:w-[38%] lg:max-w-[339px]",
            medicineImageFrameClass,
          )}
          style={{ aspectRatio: IMAGE_ASPECT }}
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={medication.medicationName}
              fill
              sizes="(max-width: 1024px) 260px, 339px"
              unoptimized={external}
              className={medicineImageFitClass}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
          <h2 className="mb-4 text-lg pt-4 font-medium tracking-[-0.3px] text-[#152A51] sm:text-[28px]">
            Current Medication Requests
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-[#152A51]/60 sm:text-sm">Medication Name</p>
              <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                {medication.medicationName}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#152A51]/60 sm:text-sm">Current Plan</p>
              <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                {medication.currentPlan}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#152A51]/60 sm:text-sm">Dose</p>
              <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                {medication.variantName || medication.dosage || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#152A51]/60 sm:text-sm">Next Refill Date</p>
              <p className="mt-1 text-sm font-medium text-[#152A51] sm:text-[15px]">
                {formatDate(medication.nextRefillDate)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefillRequest}
            disabled={!canRefill}
            className="inline-flex h-[46px] w-full mb-8 items-center justify-center gap-2 rounded-full border border-[#152A51] px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
          >
            New Refill Request
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
