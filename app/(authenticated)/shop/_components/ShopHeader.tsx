"use client";

import Image from "next/image";
import { Bell } from "lucide-react";

import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import type { ShopSortOption } from "@/lib/shop/types";

import TopSearchBar from "../../_components/TopSearchBar";

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
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

export default function ShopHeader({
  fullName,
  patientId,
  avatarUrl,
  searchQuery,
  currentCategorySlug,
  sortBy,
  searchPending = false,
  onSearchChange,
  onSearchSubmit,
}: ShopHeaderProps) {
  const external = avatarUrl ? isExternalMedicineImage(avatarUrl) : false;

  return (
    <>
      <section className="mb-4 rounded-[20px] bg-[#F3F6F6] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <TopSearchBar
            actionPath="/shop"
            placeholder="Search medicines or treatment products..."
            defaultValue={searchQuery}
            value={searchQuery}
            onValueChange={onSearchChange}
            onSubmit={onSearchSubmit}
            isPending={searchPending}
            hiddenParams={{
              category: currentCategorySlug,
              sort: sortBy,
            }}
          />
          <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <div className="relative shrink-0">
              <Bell className="h-5 w-5 text-[#152A51]" strokeWidth={1.8} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6A9B9C]" />
            </div>
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

      <section className="mb-4 flex flex-col gap-3 rounded-[16px] bg-[#E8EEED] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
        <p className="text-sm font-medium leading-snug text-[#152A51] sm:text-[15px]">
          Save up to $500 on eligible treatment plans —{" "}
          <span className="font-medium">Limited-time offer</span>
        </p>
        <button
          type="button"
          className="h-10 w-full shrink-0 rounded-full bg-[#152A51] px-5 text-sm font-medium text-white hover:bg-[#152A51]/90 sm:w-auto"
        >
          View Treatment Details →
        </button>
      </section>
    </>
  );
}
