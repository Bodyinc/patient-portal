import type { ShopSortOption } from "@/lib/shop/types";

type ShopSortBarProps = {
  sortBy: ShopSortOption;
  isPending?: boolean;
  onSelectSort: (sortBy: ShopSortOption) => void;
};

const SORT_OPTIONS: Array<{ value: ShopSortOption; label: string }> = [
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name" },
];

export default function ShopSortBar({ sortBy, isPending = false, onSelectSort }: ShopSortBarProps) {
  const selected = SORT_OPTIONS.find((option) => option.value === sortBy)?.value ?? "popular";

  return (
    <div className="flex items-center justify-end">
      <label className="flex items-center gap-2 text-xs font-medium text-[#152A51] sm:text-sm">
        Sort:
        <select
          value={selected}
          disabled={isPending}
          onChange={(event) => onSelectSort(event.target.value as ShopSortOption)}
          className="h-[45px] min-w-[170px] rounded-[14px] border-0 bg-[#E8EEED] px-3 text-xs text-[#152A51] outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
