"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getDbMedicineImageSrc } from "@/lib/intake/medicine-image";
import type { ShopMedicineCardDto } from "@/lib/shop/types";
import { formatFromPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import MedicineProductImage from "../../../onboarding/_components/MedicineProductImage";
import MedicationDetailsLayout from "../../../onboarding/_components/MedicationDetailsLayout";

export default function ShopProductCard({ item }: { item: ShopMedicineCardDto }) {
  const [open, setOpen] = useState(false);
  const [importantOpen, setImportantOpen] = useState(false);
  const router = useRouter();

  const hasVariants = item.variants.length > 0;
  const defaultVariantId = useMemo(() => {
    if (!hasVariants) return null;
    return [...item.variants].sort(
      (a, b) => (a.fromPriceCents ?? Infinity) - (b.fromPriceCents ?? Infinity),
    )[0].id;
  }, [hasVariants, item.variants]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(defaultVariantId);
  const selectedVariant = hasVariants
    ? (item.variants.find((v) => v.id === selectedVariantId) ?? null)
    : null;
  const displayFromPriceCents = hasVariants
    ? (selectedVariant?.fromPriceCents ?? null)
    : item.fromPriceCents;
  const available = displayFromPriceCents != null;

  const imageSrc = getDbMedicineImageSrc(item.imageSrc);

  useEffect(() => {
    if (!open) setImportantOpen(false);
  }, [open]);

  function handleContinue() {
    if (!available) return;
    const params = new URLSearchParams({
      id: item.id,
      name: item.name,
      category: item.categoryName,
      description: item.description,
      image: imageSrc ?? "",
    });
    if (selectedVariant) params.set("variant", selectedVariant.id);
    setOpen(false);
    router.push(`/shop/checkout?${params.toString()}`);
  }

  const variantSelect = hasVariants ? (
    <div className="space-y-2.5">
      <label className="text-[14px] font-normal text-[#152A51]">Select option</label>
      <select
        value={selectedVariantId ?? ""}
        onChange={(e) => setSelectedVariantId(e.target.value)}
        className="h-[45px] w-full rounded-[14px] border-0 bg-[#E8EEED] px-4 text-[14px] font-normal text-[#152A51] shadow-none focus:outline-none focus:ring-0"
      >
        {item.variants.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.fromPriceCents == null ? " — coming soon" : ""}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  const cardImageBlock = <MedicineProductImage src={imageSrc} alt={item.name} />;

  return (
    <>
      <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-[#E8EEED] bg-white p-3 sm:p-4">
        {cardImageBlock}

        <div className="flex flex-1 flex-col gap-2 pt-3 sm:gap-2.5 sm:pt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[16px] font-medium leading-snug tracking-[-0.25px] text-[#152A51] sm:text-[18px]">
              {item.name}
            </h3>
            <span className="shrink-0 rounded-full bg-[#F3F6F6] px-2.5 py-1 text-[11px] font-medium text-[#152A51]">
              {item.categoryName}
            </span>
          </div>
          <p className="line-clamp-2 text-[13px] leading-snug text-[#152A51]/80 sm:text-[14px]">
            {item.description}
          </p>
          <div className="mt-auto space-y-2.5 pt-3">
            <p className="text-[20px] font-medium leading-none tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
              {formatFromPrice(item.fromPriceCents)}
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="h-[42px] w-full rounded-full bg-[#E3E084] text-[13px] font-medium text-[#152A51] transition hover:bg-[#D9D674] sm:h-[46px] sm:text-[14px]"
            >
              View Details
            </button>
          </div>
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "max-h-[95vh] gap-0 overflow-y-auto scrollbar-hide border-0 bg-transparent p-2 shadow-none sm:p-3 [&>button]:right-6 [&>button]:top-6 [&>button]:z-10",
            importantOpen ? "max-w-[min(96vw,1480px)]" : "max-w-[min(96vw,820px)]",
          )}
        >
          <MedicationDetailsLayout
            name={item.name}
            description={item.description}
            imageSrc={imageSrc}
            fromPriceCents={displayFromPriceCents}
            variantSelect={variantSelect}
            importantInfo={item.importantInfo}
            notice={item.notice}
            importantOpen={importantOpen}
            onImportantOpenChange={setImportantOpen}
            continueLabel={available ? "Continue" : "Pricing coming soon"}
            continueDisabled={!available}
            onExploreMore={() => setOpen(false)}
            onContinue={handleContinue}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
