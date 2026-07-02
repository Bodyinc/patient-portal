"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { DASHBOARD_FOOTER_NAV, DASHBOARD_NAV, isNavItemActive } from "../_lib/dashboard-nav";

type DashboardSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export default function DashboardSidebar({ className, onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();

  function signOut() {
    onNavigate?.();
    window.location.href = "/auth/signout";
  }

  const navItemClass =
    "block rounded-lg px-3 py-2.5 text-base font-medium leading-snug text-[#2E00AB] transition-colors hover:bg-[#E4DAFF]/60 lg:text-xl lg:leading-none";

  return (
    <aside className={cn("flex flex-col justify-between bg-[#F3EFFF] p-4 sm:p-5", className)}>
      <div>
        <Image src="/logo.svg" alt="BodyInc" width={128} height={40} priority />

        <div className="my-5 border-b border-[#DDD4FF]" />

        <nav className="mt-3 space-y-2 sm:mt-6">
          {DASHBOARD_NAV.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(navItemClass, active && "bg-[#E4DAFF]")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {DASHBOARD_FOOTER_NAV.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(navItemClass, active && "bg-[#E4DAFF]")}
            >
              {item.label}
            </Link>
          );
        })}
        <button type="button" onClick={signOut} className={cn(navItemClass, "w-full text-left")}>
          Logout
        </button>
      </div>
    </aside>
  );
}
