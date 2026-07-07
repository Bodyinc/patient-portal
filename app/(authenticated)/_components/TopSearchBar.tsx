"use client";

import { Search } from "lucide-react";
import { FormEvent } from "react";

type TopSearchBarProps = {
  actionPath?: string;
  placeholder: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: () => void;
  inputName?: string;
  hiddenParams?: Record<string, string | number | null | undefined>;
};

export default function TopSearchBar({
  actionPath,
  placeholder,
  defaultValue = "",
  value,
  onValueChange,
  onSubmit,
  inputName = "q",
  hiddenParams,
}: TopSearchBarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!onSubmit) return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      action={actionPath}
      method={actionPath ? "get" : undefined}
      onSubmit={handleSubmit}
      /* Added bg-white, rounded-lg, internal padding, and a max-width to create the Figma input container box */
      className="flex w-full max-w-[440px] items-center gap-2.5 bg-white rounded-lg px-3.5 py-2.5"
    >
      <Search className="h-4 w-4 shrink-0 text-[#7C66D8]" />
      <input
        type="search"
        name={inputName}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-[#2E00AB] placeholder:text-[#7C66D8]/80 focus:outline-none"
        aria-label={placeholder}
      />

      {Object.entries(hiddenParams ?? {}).map(([key, value]) => {
        if (value === null || value === undefined || value === "") return null;
        return <input key={key} type="hidden" name={key} value={String(value)} />;
      })}
      <input type="hidden" name="page" value="1" />
    </form>
  );
}