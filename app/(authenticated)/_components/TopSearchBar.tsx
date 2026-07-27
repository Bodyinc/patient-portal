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
      <div className="flex h-[45px] items-center gap-2 rounded-[14px] bg-[#E8EEED] px-3">
        <Search className="h-4 w-4 text-[#152A51]/60" />
        <input
          type="search"
          name={inputName}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={(event) => onValueChange?.(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-[#152A51] placeholder:text-[#152A51]/40 focus:outline-none"
          aria-label={placeholder}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[#152A51] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {isPending ? "..." : "Search"}
        </button>
      </div>

      {Object.entries(hiddenParams ?? {}).map(([key, paramValue]) => {
        if (paramValue === null || paramValue === undefined || paramValue === "") return null;
        return <input key={key} type="hidden" name={key} value={String(paramValue)} />;
      })}
      <input type="hidden" name="page" value="1" />
    </form>
  );
}
