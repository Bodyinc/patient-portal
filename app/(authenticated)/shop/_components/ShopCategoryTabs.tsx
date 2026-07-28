import type { ShopCategoryDto, ShopSortOption } from "@/lib/shop/types";
import { cn } from "@/lib/utils";

type ShopCategoryTabsProps = {
  categories: ShopCategoryDto[];
  currentCategorySlug: string | null;
  sortBy?: ShopSortOption;
  searchQuery?: string;
  isPending?: boolean;
  onSelectCategory: (categorySlug: string | null) => void;
};

export default function ShopCategoryTabs({
  categories,
  currentCategorySlug,
  isPending = false,
  onSelectCategory,
}: ShopCategoryTabsProps) {
  const baseClass =
    "rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => onSelectCategory(null)}
        className={cn(
          baseClass,
          !currentCategorySlug
            ? "border-[#152A51] bg-[#152A51] text-white"
            : "border-[#E8EEED] bg-white text-[#152A51] hover:bg-[#F3F6F6]",
        )}
      >
        All Medicines
      </button>

      {categories.map((category) => (
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSelectCategory(category.slug)}
          key={category.id}
          className={cn(
            baseClass,
            currentCategorySlug === category.slug
              ? "border-[#152A51] bg-[#152A51] text-white"
              : "border-[#E8EEED] bg-white text-[#152A51] hover:bg-[#F3F6F6]",
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
