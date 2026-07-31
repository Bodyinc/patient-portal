"use client";

import NotificationBell from "../../_components/NotificationBell";
import TopSearchBar from "../../_components/TopSearchBar";

type BillingHeaderProps = {
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  searchQuery: string;
  searchPending?: boolean;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
};

export default function BillingHeader({
  fullName,
  patientId,
  avatarUrl,
  searchQuery,
  searchPending = false,
  onSearchChange,
  onSearchSubmit,
}: BillingHeaderProps) {
  return (
    <>
      <section className="rounded-xl border border-[#D9CCFF] bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TopSearchBar
            actionPath="/billing"
            placeholder="Search patients or records..."
            defaultValue={searchQuery}
            value={searchQuery}
            onValueChange={onSearchChange}
            onSubmit={onSearchSubmit}
            isPending={searchPending}
          />
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <NotificationBell iconClassName="h-4 w-4 text-[#152A51]" />
            <div className="flex items-center gap-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-9 w-9 rounded-md object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E8EEED] text-sm font-semibold text-[#152A51]">
                  {fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-semibold text-[#152A51]">{fullName}</p>
                <p className="text-xs text-[#152A51]/70">Patient ID: {patientId}</p>
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
