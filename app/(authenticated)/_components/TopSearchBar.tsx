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
  isPending?: boolean;
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
  isPending = false,
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
      className="w-full sm:max-w-[520px]"
    >
      <div className="flex items-center gap-2 rounded-lg border border-[#EEE9FF] bg-[#FCFBFF] px-3 py-2">
        <Search className="h-4 w-4 text-[#7C66D8]" />
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
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[#2E00AB] px-3 py-1.5 text-xs font-medium text-white"
        >
          {isPending ? "..." : "Search"}
        </button>
      </div>

      {Object.entries(hiddenParams ?? {}).map(([key, value]) => {
        if (value === null || value === undefined || value === "") return null;
        return <input key={key} type="hidden" name={key} value={String(value)} />;
      })}
      <input type="hidden" name="page" value="1" />
    </form>
  );
}
