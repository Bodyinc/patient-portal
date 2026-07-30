"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-[52px] w-full appearance-none rounded-[14px] border border-[#E8EEED] bg-white px-4 text-[15px] font-normal text-[#152A51] shadow-none transition-colors",
          "placeholder:text-[#152A51]/40",
          "outline-none focus:outline-none",
          "ring-0 focus:ring-0",
          "focus:border-[#6A9B9C]",
          "focus-visible:outline-none",
          "focus-visible:ring-0",
          "focus-visible:border-[#6A9B9C]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
