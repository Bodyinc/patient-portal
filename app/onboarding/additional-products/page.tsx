"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getAdditionalProductOptions,
  saveAdditionalProducts,
} from "@/lib/actions/additional-products";
import { formatFromPrice } from "@/lib/pricing";
import { userFacingMessage } from "@/lib/user-message";
import type { AddonGoalDto, AddonProductDto, CategoryDto } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

import GoalOptionCard from "../_components/GoalOptionCard";
import MedicineProductImage from "../_components/MedicineProductImage";
import OnboardingFooter from "../_components/OnboardingFooter";
import OnboardingFrame from "../_components/OnboardingFrame";
import { useIntakeSummary } from "../_hooks/use-intake-catalog";
import { invalidateIntakeSummary } from "../_lib/intake-query";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
} from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

type Choice = {
  medicineId: string;
  packageId: string;
};

function goalCard(goal: AddonGoalDto): CategoryDto {
  return {
    id: goal.categorySlug,
    slug: goal.categorySlug,
    name: goal.categoryName,
    tagline: goal.tagline?.trim() || "View products",
    description: null,
    icon: null,
    imageSrc: goal.imageSrc,
  };
}

function defaultPackageId(product: AddonProductDto) {
  return (product.packages.find((pkg) => pkg.isMostPopular) ?? product.packages[0]).id;
}

export default function AdditionalProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, updateState } = useOnboarding();
  const { data: summary } = useIntakeSummary();
  const [openGoals, setOpenGoals] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [showProducts, setShowProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const seeded = useRef(false);

  const optionsQuery = useQuery({
    queryKey: ["intake", "additional-products", state.goalId],
    queryFn: async () => {
      const result = await getAdditionalProductOptions(state.goalId ?? "");
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: Boolean(state.goalId),
  });

  const goals = optionsQuery.data ?? [];

  useEffect(() => {
    if (seeded.current || !goals.length || !summary?.cartItems) return;
    const nextOpen: string[] = [];
    const nextChoices: Record<string, Choice> = {};
    for (const item of summary.cartItems) {
      if (item.isPrimary || !item.packageId) continue;
      const goal = goals.find((option) => option.categorySlug === item.categorySlug);
      const product = goal?.products.find((row) => row.medicineId === item.medicineId);
      if (!goal || !product) continue;
      nextOpen.push(goal.categorySlug);
      nextChoices[goal.categorySlug] = {
        medicineId: product.medicineId,
        packageId: item.packageId,
      };
    }
    if (nextOpen.length > 0) {
      setOpenGoals(nextOpen);
      setChoices(nextChoices);
      setShowProducts(true);
    }
    seeded.current = true;
  }, [goals, summary?.cartItems]);

  const everyGoalHasMedicine = openGoals.every((slug) => {
    const choice = choices[slug];
    if (!choice) return false;
    const goal = goals.find((option) => option.categorySlug === slug);
    const product = goal?.products.find((row) => row.medicineId === choice.medicineId);
    return Boolean(product?.packages.some((pkg) => pkg.id === choice.packageId));
  });

  function toggleGoal(slug: string) {
    setOpenGoals((current) => {
      if (current.includes(slug)) {
        setChoices((existing) => {
          if (!existing[slug]) return existing;
          const next = { ...existing };
          delete next[slug];
          return next;
        });
        return current.filter((item) => item !== slug);
      }
      return [...current, slug];
    });
  }

  function chooseProduct(slug: string, product: AddonProductDto) {
    setChoices((current) => {
      const existing = current[slug];
      if (existing?.medicineId === product.medicineId) {
        const next = { ...current };
        delete next[slug];
        return next;
      }
      return {
        ...current,
        [slug]: { medicineId: product.medicineId, packageId: defaultPackageId(product) },
      };
    });
  }

  async function continueWith(
    items: Array<{
      categorySlug: string;
      medicineId: string;
      packageId: string;
      variantId: string | null;
    }>,
  ) {
    setSaving(true);
    const result = await saveAdditionalProducts({
      items,
      primaryMedicineId: state.medicationId || undefined,
      primaryCategorySlug: state.goalId || undefined,
      primaryVariantId: state.variantId,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const nextState = { ...state, additionalProductsReviewed: true };
    updateState({ additionalProductsReviewed: true });
    const next = getNextStepPath("/onboarding/additional-products", nextState);
    if (next) pushOnboardingRoute(router, next);
    void invalidateIntakeSummary(queryClient);
  }

  async function handleContinue() {
    if (!showProducts) {
      if (openGoals.length === 0) {
        await continueWith([]);
        return;
      }
      setShowProducts(true);
      return;
    }

    const items = openGoals.flatMap((slug) => {
      const choice = choices[slug];
      const goal = goals.find((option) => option.categorySlug === slug);
      const product = goal?.products.find((row) => row.medicineId === choice?.medicineId);
      if (!choice || !product) return [];
      return [
        {
          categorySlug: slug,
          medicineId: product.medicineId,
          packageId: choice.packageId,
          variantId: product.variantId,
        },
      ];
    });
    await continueWith(items);
  }

  const opened = goals.filter((goal) => openGoals.includes(goal.categorySlug));

  return (
    <OnboardingFrame
      footer={
        <OnboardingFooter
          backHref={showProducts ? null : getPrevStepPath("/onboarding/additional-products", state)}
          onBack={showProducts ? () => setShowProducts(false) : undefined}
          onContinue={() => void handleContinue()}
          continueLabel={
            showProducts ? "Continue" : openGoals.length > 0 ? "See medicines" : "Continue"
          }
          continueDisabled={
            saving || optionsQuery.isLoading || (showProducts && !everyGoalHasMedicine)
          }
          variant="figma"
        />
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="mx-auto mb-4 w-full min-w-0 max-w-[1100px] shrink-0 px-4 text-center onboarding-font sm:mb-6 sm:px-6">
          <h1 className="pt-6 text-[28px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:pt-8 sm:text-[32px]">
            {showProducts ? "Choose a medicine" : "Interested in another goal?"}
          </h1>
          <p className="mx-auto mt-3.5 max-w-2xl text-[14px] font-normal leading-snug text-[#152A51]/80">
            {showProducts
              ? `Pick one medicine for ${opened.map((goal) => goal.categoryName).join(" and ")}. Each one is added to the same checkout as ${state.goalName ?? "your treatment"}.`
              : state.goalName
                ? `Choose a goal that can be combined with ${state.goalName}, then you'll see its medicines.`
                : "Choose a goal that can be combined with yours, then you'll see its medicines."}{" "}
            {!showProducts
              ? "Everything you add is billed in one checkout and covered by one consultation."
              : "One consultation covers every treatment."}
          </p>
        </div>

        <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-8 px-4 pb-6 sm:px-6">
          {optionsQuery.isLoading ? (
            <p className="text-center text-sm text-[#152A51]/70">Loading goals…</p>
          ) : optionsQuery.isError ? (
            <div className="text-center">
              <p className="text-sm text-red-600">
                {userFacingMessage(
                  optionsQuery.error,
                  "We couldn't load extra treatments. Please refresh and try again.",
                )}
              </p>
              <button
                type="button"
                onClick={() => void optionsQuery.refetch()}
                className="mt-2 text-sm font-medium text-[#152A51] underline"
              >
                Try again
              </button>
            </div>
          ) : goals.length === 0 ? (
            <p className="text-center text-sm text-[#152A51]/70">
              {state.goalName
                ? `No other goals can be combined with ${state.goalName} right now.`
                : "No other goals can be combined with your selection right now."}{" "}
              Continue to choose your plan.
            </p>
          ) : showProducts ? null : (
            <div className="mx-auto grid w-full grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6">
              {goals.map((goal, index) => (
                <GoalOptionCard
                  key={goal.categorySlug}
                  goal={goalCard(goal)}
                  selected={openGoals.includes(goal.categorySlug)}
                  dimmed={false}
                  priority={index < 4}
                  onClick={() => toggleGoal(goal.categorySlug)}
                />
              ))}
            </div>
          )}

          {showProducts
            ? opened.map((goal) => (
                <section key={goal.categorySlug} className="flex flex-col gap-3">
                  <h2 className="text-[18px] font-medium tracking-[-0.25px] text-[#152A51] onboarding-font">
                    {goal.categoryName} products
                  </h2>
                  {goal.products.map((product) => {
                    const choice = choices[goal.categorySlug];
                    const added = choice?.medicineId === product.medicineId;
                    return (
                      <article
                        key={product.medicineId}
                        className={cn(
                          "rounded-[20px] border border-[#E8EEED] bg-white p-4 onboarding-font",
                          added && "ring-2 ring-inset ring-[#6A9B9C]/40",
                        )}
                      >
                        <div className="flex gap-4">
                          <div className="relative h-[96px] w-[72px] shrink-0 overflow-hidden rounded-[12px] bg-[#E8EEED]">
                            <MedicineProductImage
                              src={product.imageSrc}
                              alt={product.medicineName}
                              fillParent
                              frameClassName="rounded-[12px] bg-[#E8EEED]"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[16px] font-medium text-[#152A51]">
                              {product.medicineName}
                            </h3>
                            {product.description ? (
                              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[#152A51]/70">
                                {product.description}
                              </p>
                            ) : null}
                            <p className="mt-2 text-[13px] text-[#152A51]/80">
                              {formatFromPrice(product.fromPriceCents)}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-pressed={added}
                            onClick={() => chooseProduct(goal.categorySlug, product)}
                            className={cn(
                              "h-9 shrink-0 rounded-full px-4 text-[13px] font-medium",
                              added
                                ? "bg-[#152A51] text-white"
                                : "border border-[#152A51]/30 text-[#152A51]",
                            )}
                          >
                            {added ? "Added" : "Add"}
                          </button>
                        </div>
                        {added && choice ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {product.packages.map((pkg) => {
                              const active = pkg.id === choice.packageId;
                              return (
                                <button
                                  key={pkg.id}
                                  type="button"
                                  onClick={() =>
                                    setChoices((current) => ({
                                      ...current,
                                      [goal.categorySlug]: {
                                        medicineId: product.medicineId,
                                        packageId: pkg.id,
                                      },
                                    }))
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-[12px] font-medium",
                                    active
                                      ? "border-[#152A51] bg-[#152A51] text-white"
                                      : "border-[#E8EEED] text-[#152A51]",
                                  )}
                                >
                                  {pkg.name} · ${pkg.price.toFixed(2)}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </section>
              ))
            : null}

          {!showProducts && goals.length > 0 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void continueWith([])}
              className="mx-auto text-[13px] font-medium text-[#152A51]/70 underline underline-offset-2 disabled:opacity-50"
            >
              No thanks, skip this step
            </button>
          ) : null}
        </div>
      </div>
    </OnboardingFrame>
  );
}
