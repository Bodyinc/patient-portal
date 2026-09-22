"use client";

import NotificationBell from "../../_components/NotificationBell";
import PatientAvatarLink from "../../_components/PatientAvatarLink";

type BillingHeaderProps = {
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  searchQuery?: string;
  searchPending?: boolean;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
};

export default function BillingHeader({ fullName, patientId, avatarUrl }: BillingHeaderProps) {
  return (
    <section className="mb-4 rounded-[20px] bg-[#F3F6F6] px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[28px]">
            Billing
          </h1>
          <p className="text-sm text-[#152A51]/80 sm:text-[15px]">
            Manage your payment methods, billing history, invoices, and subscriptions.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
          <NotificationBell />
          <div className="flex min-w-0 items-center gap-3">
            <PatientAvatarLink fullName={fullName} avatarUrl={avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#152A51] sm:text-base">{fullName}</p>
              <p className="truncate text-xs text-[#152A51]/60 sm:text-sm">
                Patient ID: {patientId}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
