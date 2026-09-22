"use client";

import Link from "next/link";

import type { PortalOfferDto } from "@/lib/offers/types";

import NotificationBell from "../../_components/NotificationBell";
import PatientAvatarLink from "../../_components/PatientAvatarLink";

type MyMedsHeaderProps = {
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  offer?: PortalOfferDto | null;
};

function offerTrailingCopy(offer: PortalOfferDto): string | null {
  if (offer.couponCode) return `Use code ${offer.couponCode}`;
  if (offer.badgeText) return offer.badgeText;
  return null;
}

export default function MyMedsHeader({
  fullName,
  patientId,
  avatarUrl,
  offer = null,
}: MyMedsHeaderProps) {
  const trailing = offer ? offerTrailingCopy(offer) : null;

  return (
    <>
      <section className="mb-4 rounded-[20px] bg-[#F3F6F6] px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[28px]">
              My Meds
            </h1>
            <p className="max-w-xl text-sm text-[#152A51]/80 sm:text-[15px]">
              Manage your medications, refill requests, and track your treatment progress.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <NotificationBell />
            <div className="flex min-w-0 items-center gap-3">
              <PatientAvatarLink fullName={fullName} avatarUrl={avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#152A51] sm:text-base">
                  {fullName}
                </p>
                <p className="truncate text-xs text-[#152A51]/60 sm:text-sm">
                  Patient ID: {patientId}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {offer ? (
        <section className="mb-4 flex flex-col gap-3 rounded-[16px] bg-[#E8EEED] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
          <p className="text-sm font-medium leading-snug text-[#152A51] sm:text-[15px]">
            {offer.headline}
            {trailing ? (
              <>
                {" "}
                — <span className="font-medium">{trailing}</span>
              </>
            ) : null}
          </p>
          <Link
            href={offer.ctaHref}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90 sm:w-auto"
          >
            {offer.ctaLabel.includes("→") ? offer.ctaLabel : `${offer.ctaLabel} →`}
          </Link>
        </section>
      ) : null}
    </>
  );
}
