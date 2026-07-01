"use client";

import { Bell } from "lucide-react";

type DashboardHeaderProps = {
  fullName?: string | null;
};

export default function DashboardHeader({ fullName }: DashboardHeaderProps) {
  const displayName = fullName ? `, ${fullName}` : ", James";

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl bg-gradient-to-r from-[#F7F4FF] to-[#F3EEFF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
      <div>
        <h1 className="text-xl font-semibold leading-tight text-[#2E00AB] sm:text-2xl lg:text-[34px] lg:leading-none">
          Good morning{displayName}
        </h1>

        <p className="mt-2 text-sm leading-snug text-[#2E00AB] sm:mt-2.5 sm:text-base lg:text-base lg:leading-snug">
          Here&apos;s an update on your health journey and upcoming treatment milestones.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <div className="relative">
          <Bell className="h-5 w-5 text-[#4F1DDB]" strokeWidth={1.8} />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
        </div>

        <div className="flex items-center gap-3">
          <img
            src="https://i.pravatar.cc/60"
            alt="Profile"
            className="h-9 w-9 rounded-lg object-cover sm:h-[42px] sm:w-[42px]"
          />

          <div>
            <p className="text-sm font-semibold text-[#4F1DDB] sm:text-base">
              {fullName || "James Wilson"}
            </p>
            <p className="text-xs text-[#7B5CF1] sm:text-sm">Patient ID: #BI-2048</p>
          </div>
        </div>
      </div>
    </div>
  );
}
