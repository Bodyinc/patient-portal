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
    "rounded-full border px-4 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";

  const activeClass = "border-[#E3E084] bg-[#E3E084] text-[#152A51]";
  const inactiveClass = "border-[#E8EEED] bg-white text-[#152A51] hover:bg-[#F3F6F6]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => onSelectCategory(null)}
        className={cn(baseClass, !currentCategorySlug ? activeClass : inactiveClass)}
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
            currentCategorySlug === category.slug ? activeClass : inactiveClass,
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
