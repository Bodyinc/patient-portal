"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getDbMedicineImageSrc, isExternalMedicineImage } from "@/lib/intake/medicine-image";
import type { ShopMedicineCardDto } from "@/lib/shop/types";
import { formatFromPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import {
  medicineImageFrameClass,
  medicineImageFitClass,
} from "../../../onboarding/_lib/onboarding-theme";

const IMAGE_ASPECT = "339 / 354.6";

export default function ShopProductCard({ item }: { item: ShopMedicineCardDto }) {
  const [open, setOpen] = useState(false);
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
  const external = imageSrc ? isExternalMedicineImage(imageSrc) : false;

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

  const imageBlock = (
    <div className={cn("w-full", medicineImageFrameClass)} style={{ aspectRatio: IMAGE_ASPECT }}>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={item.name}
          fill
          sizes="(max-width: 1024px) 100vw, 339px"
          unoptimized={external}
          className={medicineImageFitClass}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-[#E8EEED] bg-white p-3 sm:p-4">
        {imageBlock}

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
              className="h-[42px] w-full rounded-full bg-[#152A51] text-[13px] font-medium text-white transition hover:bg-[#152A51]/90 sm:h-[46px] sm:text-[14px]"
            >
              View Details
            </button>
          </div>
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] max-w-4xl gap-0 overflow-y-auto scrollbar-hide rounded-[24px] border-[#E8EEED] p-4 sm:rounded-[24px] sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,339px)_1fr]">
            <div className="flex h-full flex-col justify-between rounded-[24px] border border-[#E8EEED] bg-white p-3">
              {imageBlock}
              <p className="mt-4 px-1 text-[22px] font-medium tracking-[-0.3px] text-[#152A51]">
                {formatFromPrice(displayFromPriceCents)}
              </p>
            </div>

            <div className="flex min-w-0 flex-col justify-between py-1">
              <div>
                <DialogTitle className="text-[28px] font-medium leading-tight tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
                  {item.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detailed information about {item.name}
                </DialogDescription>

                <p className="mt-4 text-[15px] leading-relaxed text-[#152A51]">
                  {item.description}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-[#152A51]/80">
                  This treatment plan is personalized based on your health assessment and clinician
                  recommendations for safe and sustainable progress.
                </p>

                {hasVariants ? <div className="mt-5 max-w-xs">{variantSelect}</div> : null}

                <div className="mt-6">
                  <h3 className="text-[15px] font-medium text-[#152A51]">Important Information</h3>
                  <ul className="mt-3 space-y-2.5">
                    <li className="border-l-[3px] border-[#6A9B9C] pl-3 text-[14px] text-[#152A51]">
                      Prescription required following clinical approval.
                    </li>
                    <li className="border-l-[3px] border-[#6A9B9C] pl-3 text-[14px] text-[#152A51]">
                      Contact your provider if you experience unexpected side effects.
                    </li>
                    <li className="border-l-[3px] border-[#6A9B9C] pl-3 text-[14px] text-[#152A51]">
                      Individual results may vary based on medical history and lifestyle.
                    </li>
                    <li className="border-l-[3px] border-[#6A9B9C] pl-3 text-[14px] text-[#152A51]">
                      Use only as directed by your care team.
                    </li>
                  </ul>
                </div>

                <div className="mt-6 rounded-[16px] border border-[#E8EEED] bg-[#F3F6F6] p-4">
                  <h4 className="text-[13px] font-medium text-[#152A51]">Notice</h4>
                  <p className="mt-1 text-[12px] leading-normal text-[#152A51]/80">
                    * Prescription required. Professional medical consultation necessary before
                    fulfillment.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="h-[46px] w-full rounded-full border-[#152A51]/30 bg-transparent px-6 text-[14px] font-medium text-[#152A51] shadow-none hover:bg-[#152A51]/5 sm:w-auto"
                >
                  Explore More
                </Button>
                <Button
                  type="button"
                  onClick={handleContinue}
                  disabled={!available}
                  className={cn(
                    "h-[46px] w-full rounded-full px-6 text-[14px] font-medium shadow-none sm:w-auto",
                    available
                      ? "bg-[#E3E084] text-[#152A51] hover:bg-[#D9D674]"
                      : "bg-[#E8EEED] text-[#152A51]/50",
                  )}
                >
                  {available ? "Continue" : "Pricing coming soon"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
