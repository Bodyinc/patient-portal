"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

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
  // Tracks if the avatar image fails to load
  const [imageError, setImageError] = useState(false);

  return (
    <>
      {/* Clean, transparent wrapper to match Figma layout without white background or border */}
      <section className="w-full pt-4 pb-2">
        <div className="flex items-center justify-between gap-6">
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
          
          <div className="flex shrink-0 items-center gap-4">
            <Bell className="h-5 w-5 text-[#2E00AB] cursor-pointer" />
            <div className="flex items-center gap-2.5">
              {avatarUrl && !imageError ? (
                <img 
                  src={avatarUrl} 
                  alt={fullName} 
                  className="h-9 w-9 rounded-md object-cover" 
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#EDE7FF] text-sm font-semibold text-[#2E00AB]">
                  {fullName.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div className="text-left">
                <p className="text-sm font-semibold text-[#2E00AB] leading-tight">{fullName}</p>
                <p className="text-xs text-[#2E00AB]/70 mt-0.5">Patient ID: {patientId}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Bar with mt-3 gap below the search bar */}
      <section className="mt-3 rounded-md border border-[#F0E7CF] bg-[#FFEB99] px-4 py-3">
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