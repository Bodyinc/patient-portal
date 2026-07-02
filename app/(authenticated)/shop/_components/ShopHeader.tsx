"use client";

import { Bell } from "lucide-react";

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
  return (
    <>
      <section className="rounded-xl border border-[#D9CCFF] bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Bell className="h-4 w-4 text-[#2E00AB]" />
            <div className="flex items-center gap-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-9 w-9 rounded-md object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#EDE7FF] text-sm font-semibold text-[#2E00AB]">
                  {fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-semibold text-[#2E00AB]">{fullName}</p>
                <p className="text-xs text-[#2E00AB]/70">Patient ID: {patientId}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-[#F0E7CF] bg-[#FFEB99] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#4B3A00]">
            Save up to $500 on eligible treatment plans{" "}
            <span className="font-semibold">Limited-time offer</span>
          </p>
          <button
            type="button"
            className="self-start rounded-sm bg-[#2C2300] px-3 py-1.5 text-xs font-medium text-white sm:self-auto"
          >
            View Treatment Details →
          </button>
        </div>
      </section>
    </>
  );
}
