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
    "block rounded-[12px] px-3 py-2.5 text-base font-medium leading-snug text-[#152A51] transition-colors hover:bg-[#E8EEED]/80 lg:text-[18px] lg:leading-none";

  return (
    <aside
      className={cn("flex min-h-0 flex-col justify-between bg-[#F3F6F6] p-4 sm:p-5", className)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        <div className="flex justify-center">
          <Image src="/logo.svg" alt="BodyInc" width={128} height={40} priority />
        </div>

        <div className="my-5 border-b border-[#E8EEED]" />

        <nav className="mt-3 space-y-2 sm:mt-6">
          {DASHBOARD_NAV.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(navItemClass, active && "bg-[#E8EEED]")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 space-y-2 pt-3 sm:space-y-3">
        {DASHBOARD_FOOTER_NAV.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(navItemClass, active && "bg-[#E8EEED]")}
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
