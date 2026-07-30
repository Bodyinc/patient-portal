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
      className={cn(
        "flex h-full w-full flex-col justify-between border-r border-[#E5E7EB] bg-white px-5 pb-5 pt-6",
        className,
      )}
    >
      {/* Top navigation container that scrolls internally if items exceed height */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        <div className="flex justify-center">
          <Image src="/logo.svg" alt="BodyInc" width={128} height={40} priority />
        </div>

        <div className="my-5 border-b border-[#E5E7EB]" />

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

      {/* Figma sidebar-bottom: vertical, hug height, gap 12px, fill width */}
      <div className="flex w-full shrink-0 flex-col gap-3 pt-3">
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
