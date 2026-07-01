"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import DashboardSidebar from "./DashboardSidebar";

type DashboardShellProps = {
  children: ReactNode;
};

export default function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <div className="flex items-center justify-between border-b border-[#DDD4FF] bg-[#F3EFFF] px-4 py-2.5 lg:hidden">
        <Image src="/logo.svg" alt="BodyInc" width={96} height={30} priority />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-[#2E00AB]">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[224px] bg-[#F3EFFF] p-0">
            <DashboardSidebar className="h-full rounded-none" />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden shrink-0 lg:block lg:w-[224px] xl:w-[256px]">
        <DashboardSidebar className="sticky top-0 m-2 h-[calc(100vh-1rem)] rounded-[12px]" />
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
