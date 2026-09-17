"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPortalDate } from "@/lib/date-format";
import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import type { DashboardPageDataDto } from "@/lib/dashboard/types";
import { buildShopCheckoutHref } from "@/lib/shop/checkout-href";
import { cn } from "@/lib/utils";

import MedicineProductImage from "../../../onboarding/_components/MedicineProductImage";
import DashboardHeader from "../../_components/DashboardHeader";
import { openConsultationInNewTab } from "@/lib/consultations/open-visit";

type DashboardPageClientProps = {
  data: DashboardPageDataDto;
};

function formatDate(value: string | null): string {
  return formatPortalDate(value);
}

function HealthGoalHeroCard({ name, imageSrc }: { name: string; imageSrc: string | null }) {
  const external = imageSrc ? isExternalMedicineImage(imageSrc) : false;

  return (
    <div className="relative min-h-[200px] w-full overflow-hidden rounded-[24px] border border-[#E8EEED] bg-[#E8EEED] sm:min-h-[240px] lg:h-[304px] lg:min-h-0">
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 40vw"
          unoptimized={external}
          className="object-cover object-center"
        />
      ) : null}
      <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-[14px] border border-white/10 bg-[#0A172D]/14 px-6 py-4 backdrop-blur-[2px]">
        <p className="text-xs font-normal leading-none text-white/90 sm:text-[13px]">
          Your health goals
        </p>
        <p className="mt-3.5 text-lg font-medium leading-snug tracking-[-0.25px] text-white sm:text-[22px]">
          {name}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPageClient({ data }: DashboardPageClientProps) {
  const router = useRouter();
  const duePayment = data.pendingPayments[0] ?? null;
  const dueAmount = duePayment
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        duePayment.amountCents / 100,
      )
    : null;
  const canRefill =
    data.treatment?.consultationStatus === "closed" && Boolean(data.treatment.medicineId);
  const consultationStatus = data.treatment?.consultationStatus ?? "none";
  const showConsultationCta = data.consultationsEnabled && Boolean(data.treatment?.subscriptionId);

  const treatmentFields = data.treatment
    ? [
        { label: "Medication Name", value: data.treatment.name },
        { label: "Dose", value: data.treatment.variantDose },
        { label: "Current Plan", value: data.treatment.currentPlan },
        { label: "Next Refill Date", value: formatDate(data.treatment.nextRefillDate) },
      ]
    : [];

  function handleRefillRequest() {
    if (!data.treatment?.medicineId) return;
    router.push(
      buildShopCheckoutHref({
        medicineId: data.treatment.medicineId,
        variantId: data.treatment.variantId,
        packageId: data.treatment.packageId,
        from: "dashboard",
      }),
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] flex-1 px-2 py-4 sm:px-4 lg:px-6 xl:px-8">
      <DashboardHeader
        fullName={data.fullName}
        patientId={data.patientId}
        avatarUrl={data.avatarUrl}
      />

      {/* Figma top row: Ready to begin 1042×304 + health goal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.88fr)_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[minmax(0,1042px)_minmax(0,553px)]">
        <section className="flex flex-col rounded-[24px] border border-[#E8EEED] bg-white p-6 lg:h-[304px]">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#152A51]/60 sm:text-sm">
            <span>Next step</span>
          </div>
          {duePayment ? (
            <>
              <h3 className="text-lg font-medium leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
                Additional payment required
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#152A51]/80 sm:text-[15px] sm:leading-7">
                {dueAmount} is due to continue your {duePayment.medicineName} prescription
                {duePayment.orderNumber ? ` (${duePayment.orderNumber})` : ""}. Pay now so your care
                team can send it to the pharmacy.
                {data.pendingPayments.length > 1
                  ? ` You have ${data.pendingPayments.length} payments waiting.`
                  : ""}
              </p>
              <div className="mt-auto flex flex-col gap-3 pt-5 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="h-[46px] w-full rounded-full bg-[#152A51] px-6 text-sm font-medium text-white hover:bg-[#152A51]/90 sm:w-fit"
                >
                  <Link href={`/orders/${duePayment.requestId}/pay`}>Pay now</Link>
                </Button>
                {data.pendingPayments.length > 1 ? (
                  <Link
                    href="/my-meds"
                    className="text-sm font-medium text-[#152A51] underline underline-offset-2 hover:text-[#152A51]/80"
                  >
                    View all on My Meds
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium leading-snug tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
                Ready to begin your treatment journey?
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#152A51]/80 sm:text-[15px] sm:leading-7">
                Complete your intake form to start your consultation with a licensed clinician.
                Please answer all questions to the best of your ability.
              </p>
              <div className="mt-auto pt-5">
                {consultationStatus === "closed" ? (
                  <Button
                    type="button"
                    disabled
                    className="h-[46px] w-full rounded-full bg-[#E3E084] px-6 text-sm font-medium text-[#152A51] disabled:opacity-100 sm:w-fit"
                  >
                    Intake form closed
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="h-[46px] w-full rounded-full bg-[#E3E084] px-6 text-sm font-medium text-[#152A51] hover:bg-[#D9D674] sm:w-fit"
                  >
                    <Link href="/consultations">Complete intake form</Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="flex min-w-0 flex-col">
          {data.goals.length > 0 ? (
            <ul className="flex min-h-0 flex-1 flex-col gap-4">
              {data.goals.map((goal) => (
                <li key={goal.id} className="min-h-0 flex-1">
                  <HealthGoalHeroCard name={goal.name} imageSrc={goal.imageSrc?.trim() || null} />
                </li>
              ))}
            </ul>
          ) : (
            <section className="flex min-h-[200px] items-center justify-center rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:min-h-[240px] lg:h-[304px] lg:min-h-0">
              <p className="text-sm text-[#152A51]/60">No health goals on file yet.</p>
            </section>
          )}
        </aside>
      </div>

      {data.treatment ? (
        /* Figma treatment row: radius 10, pr 20, gap 32, bottle flush to card height */
        <section className="mt-4 rounded-[10px] border border-[#E8EEED] bg-white">
          <div className="flex min-h-[102px] flex-col sm:flex-row sm:items-center sm:gap-6 sm:pr-5">
            <div className="relative mx-auto h-[102px] w-[102px] shrink-0 overflow-hidden rounded-[10px] bg-[#E8EEED] sm:mx-0 sm:h-[102px] sm:w-[102px] sm:self-center">
              <MedicineProductImage
                src={data.treatment.imageSrc}
                alt={data.treatment.name}
                fillParent
                frameClassName="rounded-[10px] bg-[#E8EEED]"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-0 sm:py-3">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:min-w-0 xl:flex-1 xl:items-center xl:gap-0">
                {treatmentFields.map((field, index) => (
                  <div
                    key={field.label}
                    className={cn(
                      "min-w-0 xl:max-w-[180px] xl:px-3",
                      index > 0 && "xl:border-l xl:border-[#E8EEED]",
                      index === 0 && "xl:pl-0",
                    )}
                  >
                    <p className="text-xs text-[#152A51]/60 sm:text-[13px]">{field.label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-[#152A51] sm:text-[15px]">
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {showConsultationCta && consultationStatus === "none" ? (
                  <DashboardConsultationButton
                    subscriptionId={data.treatment.subscriptionId!}
                    label="Start consultation"
                  />
                ) : null}
                {showConsultationCta && consultationStatus === "open" ? (
                  <DashboardConsultationButton
                    subscriptionId={data.treatment.subscriptionId!}
                    label="Open consultation"
                  />
                ) : null}
                {showConsultationCta && consultationStatus === "closed" ? (
                  <DashboardConsultationButton
                    subscriptionId={data.treatment.subscriptionId!}
                    label="Closed consultation"
                    variant="secondary"
                  />
                ) : null}
                {canRefill ? (
                  <button
                    type="button"
                    onClick={handleRefillRequest}
                    className="inline-flex h-[46px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#152A51]/20 bg-white px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6]"
                  >
                    New Refill Request
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {data.activeTreatmentCount > 1 ? (
            <p className="border-t border-[#E8EEED] px-4 py-3 text-sm text-[#152A51]/70 sm:px-5">
              You have {data.activeTreatmentCount} active treatments.{" "}
              <Link
                href="/my-meds"
                className="font-medium text-[#152A51] underline underline-offset-2 hover:text-[#152A51]/80"
              >
                View all on My Meds
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function DashboardConsultationButton({
  subscriptionId,
  label,
  variant = "primary",
}: {
  subscriptionId: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        void (async () => {
          setBusy(true);
          const opened = await openConsultationInNewTab(subscriptionId);
          setBusy(false);
          if (!opened) return;
          router.refresh();
        })();
      }}
      className={
        variant === "secondary"
          ? "inline-flex h-[46px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[#152A51]/20 bg-white px-5 text-sm font-medium text-[#152A51] hover:bg-[#F3F6F6] disabled:opacity-60"
          : "inline-flex h-[46px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90 disabled:opacity-60"
      }
    >
      {busy ? "Opening…" : label}
    </button>
  );
}
