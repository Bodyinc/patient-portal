"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-[52px] w-full appearance-none rounded-md border border-[#F2F2F2] bg-white px-4 text-[15px] font-normal text-[#2E00AB] shadow-none transition-colors",
        "placeholder:text-[#8C74E8]",
        "outline-none focus:outline-none",
        "ring-0 focus:ring-0",
        "focus:border-[#2E00AB]",
        "focus-visible:outline-none",
        "focus-visible:ring-0",
        "focus-visible:border-[#2E00AB]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };