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
      <label className="flex items-center gap-2 text-xs font-medium text-[#2E00AB] sm:text-sm">
        Sort:
        <select
          value={selected}
          disabled={isPending}
          onChange={(event) => onSelectSort(event.target.value as ShopSortOption)}
          className="min-w-[170px] rounded-md border border-[#D5CAFF] bg-white px-3 py-2 text-xs text-[#2E00AB] outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
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
