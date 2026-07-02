import type { ShopCategoryDto, ShopSortOption } from "@/lib/shop/types";

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
    "rounded-md border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => onSelectCategory(null)}
        className={`${baseClass} ${
          !currentCategorySlug
            ? "border-[#2E00AB] bg-[#2E00AB] text-white"
            : "border-[#D5CAFF] bg-white text-[#2E00AB]"
        }`}
      >
        All Medicines
      </button>

      {categories.map((category) => (
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSelectCategory(category.slug)}
          key={category.id}
          className={`${baseClass} ${
            currentCategorySlug === category.slug
              ? "border-[#2E00AB] bg-[#2E00AB] text-white"
              : "border-[#D5CAFF] bg-white text-[#2E00AB]"
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
