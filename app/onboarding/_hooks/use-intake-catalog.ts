"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getActiveCategories,
  getIntakeSummary,
  getMedicinesForCategory,
  getPackagesForMedicine,
  getQuestionnaireForMedicine,
} from "@/lib/actions/intake";
import { CATALOG_STALE_MS, intakeQueryKeys, SUMMARY_STALE_MS } from "@/lib/intake/query-keys";

export function useIntakeCategories() {
  return useQuery({
    queryKey: intakeQueryKeys.categories,
    queryFn: async () => {
      const result = await getActiveCategories();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: CATALOG_STALE_MS,
  });
}

export function useMedicinesForCategory(categorySlug: string | null) {
  return useQuery({
    queryKey: intakeQueryKeys.medicines(categorySlug),
    queryFn: async () => {
      if (!categorySlug) {
        return { medicines: [], categoryEligible: true, ineligibleReason: null };
      }
      const result = await getMedicinesForCategory(categorySlug);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: Boolean(categorySlug),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useQuestionnaire(medicineId: string | null) {
  return useQuery({
    queryKey: intakeQueryKeys.questionnaire(medicineId),
    queryFn: async () => {
      if (!medicineId) return null;
      const result = await getQuestionnaireForMedicine(medicineId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: Boolean(medicineId),
    staleTime: CATALOG_STALE_MS,
  });
}

export function usePackages(medicineId: string | null, variantId?: string | null) {
  return useQuery({
    queryKey: intakeQueryKeys.packages(medicineId, variantId),
    queryFn: async () => {
      if (!medicineId) return [];
      const result = await getPackagesForMedicine(medicineId, variantId ?? null);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: Boolean(medicineId),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useIntakeSummary() {
  return useQuery({
    queryKey: intakeQueryKeys.summary,
    queryFn: async () => {
      const result = await getIntakeSummary();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: SUMMARY_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useInvalidateIntakeSummary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: intakeQueryKeys.summary });
}
