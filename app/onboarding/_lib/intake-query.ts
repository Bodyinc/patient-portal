"use client";

import type { QueryClient } from "@tanstack/react-query";

import {
  getIntakeSummary,
  getMedicinesForCategory,
  getPackagesForMedicine,
  getQuestionnaireForMedicine,
} from "@/lib/actions/intake";
import { CATALOG_STALE_MS, intakeQueryKeys, SUMMARY_STALE_MS } from "@/lib/intake/query-keys";

export async function invalidateIntakeSummary(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: intakeQueryKeys.summary });
}

export async function prefetchMedicinesForCategory(queryClient: QueryClient, categorySlug: string) {
  await queryClient.prefetchQuery({
    queryKey: intakeQueryKeys.medicines(categorySlug),
    queryFn: async () => {
      const result = await getMedicinesForCategory(categorySlug);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: CATALOG_STALE_MS,
  });
}

export async function prefetchQuestionnaireAndPackages(
  queryClient: QueryClient,
  medicineId: string,
) {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: intakeQueryKeys.questionnaire(medicineId),
      queryFn: async () => {
        const result = await getQuestionnaireForMedicine(medicineId);
        if (!result.ok) throw new Error(result.message);
        return result.data;
      },
      staleTime: CATALOG_STALE_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: intakeQueryKeys.packages(medicineId),
      queryFn: async () => {
        const result = await getPackagesForMedicine(medicineId);
        if (!result.ok) throw new Error(result.message);
        return result.data;
      },
      staleTime: CATALOG_STALE_MS,
    }),
  ]);
}

export async function prefetchIntakeSummary(queryClient: QueryClient) {
  await queryClient.prefetchQuery({
    queryKey: intakeQueryKeys.summary,
    queryFn: async () => {
      const result = await getIntakeSummary();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: SUMMARY_STALE_MS,
  });
}
