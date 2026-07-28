"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import "../dashboard.css";
import DashboardSidebar from "./DashboardSidebar";

type DashboardShellProps = {
  children: ReactNode;
};

export default function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="dashboard-font flex min-h-screen flex-col overflow-x-hidden bg-white lg:flex-row">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-2.5 lg:hidden">
        <Image src="/logo.svg" alt="BodyInc" width={96} height={30} priority />
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-[#152A51]">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] border-r border-[#E5E7EB] bg-white p-0">
            <DashboardSidebar className="h-full" onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Figma sidebar: fixed 260px, white, right border only — no rounded inset */}
      <aside className="hidden lg:flex lg:w-[260px] lg:min-w-[260px] lg:max-w-[260px] lg:shrink-0">
        <DashboardSidebar className="sticky top-0 h-dvh w-full" />
      </aside>

      <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
