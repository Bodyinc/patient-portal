"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { isExternalMedicineImage } from "@/lib/intake/medicine-image";

import NotificationBell from "./NotificationBell";

type DashboardHeaderProps = {
  fullName?: string | null;
  patientId?: string | null;
  avatarUrl?: string | null;
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

/** Local-time greeting for the patient dashboard. */
function greetingForHour(hour: number): { title: string; subtitle: string } {
  if (hour >= 5 && hour < 12) {
    return {
      title: "Good morning",
      subtitle: "Here's an update on your health journey",
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      title: "Good afternoon",
      subtitle: "Here's an update on your health journey",
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      title: "Good evening",
      subtitle: "Here's an update on your health journey",
    };
  }
  // 21:00–4:59 — late night / staying up
  return {
    title: "Still up late",
    subtitle: "Take it easy — here's a quick look at your care",
  };
}

export default function DashboardHeader({ fullName, patientId, avatarUrl }: DashboardHeaderProps) {
  const name = fullName?.trim() || "Patient";
  const greetingName = fullName?.trim() ? `, ${fullName.trim()}` : "";
  const external = avatarUrl ? isExternalMedicineImage(avatarUrl) : false;

  // Avoid SSR/client time mismatch; resolve after mount from the patient's local clock.
  const [greeting, setGreeting] = useState({
    title: "Hello",
    subtitle: "Here's an update on your health journey",
  });

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[20px] bg-[#F3F6F6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
      <div className="min-w-0">
        <h1 className="text-xl font-medium leading-tight tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[32px] lg:leading-none">
          {greeting.title}
          {greetingName}
        </h1>
        <p className="mt-2 text-sm leading-snug text-[#152A51]/80 sm:mt-2.5 sm:text-[15px]">
          {greeting.subtitle}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <NotificationBell />

        <div className="flex min-w-0 items-center gap-3">
          {avatarUrl ? (
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full sm:h-[42px] sm:w-[42px]">
              <Image
                src={avatarUrl}
                alt={name}
                fill
                sizes="42px"
                unoptimized={external}
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EEED] text-xs font-medium text-[#152A51] sm:h-[42px] sm:w-[42px] sm:text-sm">
              {initialsFromName(name)}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#152A51] sm:text-base">{name}</p>
            {patientId ? (
              <p className="truncate text-xs text-[#152A51]/60 sm:text-sm">
                Patient ID: {patientId}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
