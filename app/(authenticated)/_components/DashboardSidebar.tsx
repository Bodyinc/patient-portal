"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export default function DashboardSidebar({ className, onNavigate }: DashboardSidebarProps) {
  function signOut() {
    onNavigate?.();
    window.location.href = "/auth/signout";
  }

  const navItemClass =
    "rounded-lg px-3 py-2.5 text-base font-medium leading-snug text-[#2E00AB] lg:text-xl lg:leading-none";

  return (
    <aside className={cn("flex flex-col justify-between bg-[#F3EFFF] p-4 sm:p-5", className)}>
      <div>
        <Image src="/logo.svg" alt="BodyInc" width={128} height={40} priority />

        <div className="my-5 border-b border-[#DDD4FF]" />

        <nav className="mt-3 space-y-2 sm:mt-6">
          <div className={cn(navItemClass, "bg-[#E4DAFF]")}>Dashboard</div>
          <div className={navItemClass}>My Consultations</div>
          <div className={navItemClass}>Shop</div>
          <div className={navItemClass}>Intake Form</div>
        </nav>
      </div>

      <div className="space-y-2 sm:space-y-3">
        <div className={cn(navItemClass, "cursor-pointer")}>Settings</div>
        <button type="button" onClick={signOut} className={cn(navItemClass, "w-full text-left")}>
          Logout
        </button>
      </div>
    </aside>
  );
}
