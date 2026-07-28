"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { getShopCatalogFromService } from "@/lib/shop/client";
import type { ShopCategoryDto, ShopMedicinesListDto, ShopSortOption } from "@/lib/shop/types";
import { buildShopHref } from "./shop-query";
import ShopCategoryTabs from "./ShopCategoryTabs";
import ShopHeader from "./ShopHeader";
import ShopPagination from "./ShopPagination";
import ShopProductCard from "./ShopProductCard";
import ShopSortBar from "./ShopSortBar";

type ShopCatalogClientProps = {
  categories: ShopCategoryDto[];
  initialList: ShopMedicinesListDto;
  pageSize: number;
  fullName: string;
  patientId: string;
  avatarUrl: string | null;
  topContent?: ReactNode;
};

function parseSort(value: string | null): ShopSortOption {
  if (value === "price_asc") return "price_asc";
  if (value === "price_desc") return "price_desc";
  if (value === "name_asc") return "name_asc";
  return "popular";
}

export default function ShopCatalogClient({
  categories,
  initialList,
  pageSize,
  fullName,
  patientId,
  avatarUrl,
  topContent,
}: ShopCatalogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [category, setCategory] = useState<string | null>(initialList.currentCategorySlug);
  const [sortBy, setSortBy] = useState<ShopSortOption>(initialList.sortBy);
  const [page, setPage] = useState<number>(initialList.page);
  const [searchInput, setSearchInput] = useState(initialList.searchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialList.searchQuery);

  useEffect(() => {
    const nextCategory = searchParams.get("category");
    setCategory(nextCategory);
    setSortBy(parseSort(searchParams.get("sort")));
    setPage(Math.max(1, Number(searchParams.get("page") ?? "1") || 1));
    const nextQuery = (searchParams.get("q") ?? "").trim();
    setSearchInput(nextQuery);
    setDebouncedSearch(nextQuery);
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const queryKey = useMemo(
    () => ["shop", "catalog", category, sortBy, page, debouncedSearch],
    [category, sortBy, page, debouncedSearch],
  );

  const catalogQuery = useQuery({
    queryKey,
    queryFn: async () => {
      return getShopCatalogFromService({
        category,
        sort: sortBy,
        page,
        pageSize,
        q: debouncedSearch,
      });
    },
    placeholderData: (previousData) => previousData,
    initialData:
      category === initialList.currentCategorySlug &&
      sortBy === initialList.sortBy &&
      page === initialList.page &&
      debouncedSearch === initialList.searchQuery
        ? initialList
        : undefined,
  });

  useEffect(() => {
    const href = buildShopHref({
      category,
      sort: sortBy,
      page,
      q: debouncedSearch,
    });
    const nextUrl = `${pathname}${href.replace("/shop", "")}`;
    const currentUrl = `${pathname}?${searchParams.toString()}`;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [category, sortBy, page, debouncedSearch, pathname, router, searchParams]);

  const list = catalogQuery.data ?? initialList;
  const isPending = catalogQuery.isFetching;

  return (
    <section className="space-y-4">
      <ShopHeader
        fullName={fullName}
        patientId={patientId}
        avatarUrl={avatarUrl}
        searchQuery={searchInput}
        currentCategorySlug={category}
        sortBy={sortBy}
        searchPending={isPending}
        onSearchChange={(value) => {
          setSearchInput(value);
          setPage(1);
        }}
        onSearchSubmit={() => {
          setDebouncedSearch(searchInput.trim());
          setPage(1);
        }}
      />

      {topContent}

      <section className="space-y-4 rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
        <h2 className="text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
          Shop Catalog
        </h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ShopCategoryTabs
            categories={categories}
            currentCategorySlug={category}
            onSelectCategory={(nextCategory) => {
              setCategory(nextCategory);
              setPage(1);
            }}
            isPending={isPending}
          />
          <ShopSortBar
            sortBy={sortBy}
            onSelectSort={(nextSort) => {
              setSortBy(nextSort);
              setPage(1);
            }}
            isPending={isPending}
          />
        </div>
        {isPending ? (
          <div className="rounded-[14px] border border-[#E8EEED] bg-[#F3F6F6] px-3 py-2 text-xs text-[#152A51]/80">
            Updating results...
          </div>
        ) : null}

        {catalogQuery.isError ? (
          <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : "Unable to load shop catalog."}
          </div>
        ) : list.items.length === 0 ? (
          <div className="rounded-[16px] border border-[#E8EEED] bg-[#F3F6F6] p-6 text-center text-sm text-[#152A51]/70">
            No medicines found for this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {list.items.map((item) => (
              <ShopProductCard key={item.id} item={item} />
            ))}
          </div>
        )}

        <ShopPagination
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          pageSize={list.pageSize}
          onChangePage={(nextPage) => setPage(nextPage)}
          isPending={isPending}
        />
      </section>
    </section>
  );
}
