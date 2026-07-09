"use client";

import { Bell } from "lucide-react";

import TopSearchBar from "../../_components/TopSearchBar";

type MyMedsHeaderProps = {
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  searchQuery: string;
  searchPending?: boolean;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
};

export default function MyMedsHeader({
  fullName,
  patientId,
  avatarUrl,
  searchQuery,
  searchPending = false,
  onSearchChange,
  onSearchSubmit,
}: MyMedsHeaderProps) {
  return (
    <>
      <section className="rounded-xl border border-[#D9CCFF] bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TopSearchBar
            actionPath="/my-meds"
            placeholder="Search patients or records..."
            defaultValue={searchQuery}
            value={searchQuery}
            onValueChange={onSearchChange}
            onSubmit={onSearchSubmit}
            isPending={searchPending}
          />
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="relative">
              <Bell className="h-4 w-4 text-[#2E00AB]" />
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                1
              </span>
            </div>
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
