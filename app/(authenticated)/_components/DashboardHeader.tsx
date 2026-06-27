"use client";

import { Bell } from "lucide-react";

type DashboardHeaderProps = {
  fullName?: string | null;
};

export default function DashboardHeader({ fullName }: DashboardHeaderProps) {
  const displayName = fullName ? `, ${fullName}` : ", James";

  return (
    <div className="mb-5 flex flex-col gap-4 rounded-xl bg-gradient-to-r from-[#F7F4FF] to-[#F3EEFF] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
      <div>
        <h1 className="text-2xl font-semibold leading-tight text-[#2E00AB] sm:text-3xl lg:text-[42px] lg:leading-none">
          Good morning{displayName}
        </h1>

        <p className="mt-2 text-base leading-snug text-[#2E00AB] sm:mt-3 sm:text-lg lg:text-[20px] lg:leading-none">
          Here&apos;s an update on your health journey and upcoming treatment milestones.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-5">
        <div className="relative">
          <Bell className="h-6 w-6 text-[#4F1DDB]" strokeWidth={1.8} />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
        </div>

        <div className="flex items-center gap-3">
          <img
            src="https://i.pravatar.cc/60"
            alt="Profile"
            className="h-11 w-11 rounded-lg object-cover sm:h-[52px] sm:w-[52px]"
          />

          <div>
            <p className="font-semibold text-[#4F1DDB]">{fullName || "James Wilson"}</p>
            <p className="text-sm text-[#7B5CF1]">Patient ID: #BI-2048</p>
          </div>
        </div>
      </div>
    </div>
  );
}
