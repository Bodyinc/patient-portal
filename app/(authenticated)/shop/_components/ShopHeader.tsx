"use client";

import Image from "next/image";
import Link from "next/link";

import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import type { PortalOfferDto } from "@/lib/offers/types";
import type { ShopSortOption } from "@/lib/shop/types";

import NotificationBell from "../../_components/NotificationBell";

type ShopHeaderProps = {
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  searchQuery: string;
  currentCategorySlug: string | null;
  sortBy: ShopSortOption;
  searchPending?: boolean;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  offer?: PortalOfferDto | null;
  title?: string;
  subtitle?: string;
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function offerTrailingCopy(offer: PortalOfferDto): string | null {
  if (offer.couponCode) return `Use code ${offer.couponCode}`;
  if (offer.badgeText) return offer.badgeText;
  return null;
}

export default function ShopHeader({
  fullName,
  patientId,
  avatarUrl,
  offer = null,
  title = "Shop",
  subtitle = "Browse medications and healthcare products available for your treatment journey.",
}: ShopHeaderProps) {
  const external = avatarUrl ? isExternalMedicineImage(avatarUrl) : false;
  const trailing = offer ? offerTrailingCopy(offer) : null;

  return (
    <>
      <section className="mb-4 rounded-[20px] bg-[#F3F6F6] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="space-y-1 px-1">
            <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[28px]">
              {title}
            </h1>
            <p className="text-sm text-[#152A51]/80 sm:text-[15px]">{subtitle}</p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <NotificationBell />
            <div className="flex min-w-0 items-center gap-3">
              {avatarUrl ? (
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full sm:h-[42px] sm:w-[42px]">
                  <Image
                    src={avatarUrl}
                    alt={fullName}
                    fill
                    sizes="42px"
                    unoptimized={external}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EEED] text-xs font-medium text-[#152A51] sm:h-[42px] sm:w-[42px] sm:text-sm">
                  {initialsFromName(fullName)}
                </div>
              )}
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
