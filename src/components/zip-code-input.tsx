"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { ZIP_CODE_MAX_DIGITS, digitsOnlyZip } from "@/lib/validation";

type ZipCodeInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "maxLength" | "inputMode" | "pattern" | "type"
> & {
  value: string;
  onChange: (value: string) => void;
};

export function ZipCodeInput({ value, onChange, ...props }: ZipCodeInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="postal-code"
      pattern="[0-9]*"
      maxLength={ZIP_CODE_MAX_DIGITS}
      value={digitsOnlyZip(value)}
      onChange={(e) => onChange(digitsOnlyZip(e.target.value))}
      onBeforeInput={(event) => {
        const data = (event.nativeEvent as InputEvent).data;
        if (data && /\D/.test(data)) event.preventDefault();
      }}
    />
  );
}
