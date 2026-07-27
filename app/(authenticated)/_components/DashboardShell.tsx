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
      <div className="flex items-center justify-between border-b border-[#E8EEED] bg-[#F3F6F6] px-4 py-2.5 lg:hidden">
        <Image src="/logo.svg" alt="BodyInc" width={96} height={30} priority />
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-[#152A51]">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[224px] bg-[#F3F6F6] p-0">
            <DashboardSidebar
              className="h-full rounded-none"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden shrink-0 lg:block lg:w-[220px] xl:w-[248px]">
        <DashboardSidebar className="sticky top-0 m-2 h-[calc(100dvh-1rem)] max-h-screen rounded-[16px]" />
      </aside>

      <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
