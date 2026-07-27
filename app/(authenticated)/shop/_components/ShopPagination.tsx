import type { ShopSortOption } from "@/lib/shop/types";

type ShopPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  currentCategorySlug?: string | null;
  sortBy?: ShopSortOption;
  searchQuery?: string;
  isPending?: boolean;
  onChangePage: (page: number) => void;
};

export default function ShopPagination({
  page,
  totalPages,
  total,
  pageSize,
  isPending = false,
  onChangePage,
}: ShopPaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#152A51]/70">
        Showing {start}-{end} of {total} Medicines
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onChangePage(page - 1)}
            className="rounded-full border border-[#E8EEED] px-4 py-1.5 text-sm text-[#152A51] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
        ) : (
          <span className="rounded-full border border-[#E8EEED] px-4 py-1.5 text-sm text-[#152A51]/40">
            Previous
          </span>
        )}

        {page < totalPages ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onChangePage(page + 1)}
            className="rounded-full bg-[#152A51] px-4 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        ) : (
          <span className="rounded-full border border-[#E8EEED] px-4 py-1.5 text-sm text-[#152A51]/40">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
