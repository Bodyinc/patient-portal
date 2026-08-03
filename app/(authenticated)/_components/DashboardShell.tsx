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
    // Change min-h-screen to h-screen overflow-hidden
    <div className="dashboard-font flex h-screen overflow-hidden bg-white lg:flex-row">
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

      {/* Sidebar container strictly locked to full height */}
      <aside className="hidden lg:flex lg:h-full lg:w-[260px] lg:min-w-[260px] lg:max-w-[260px] lg:shrink-0">
        <DashboardSidebar className="h-full w-full" />
      </aside>

      {/* Dashboard area scrolls independently when content overflows */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
