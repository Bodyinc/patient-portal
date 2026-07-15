"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ShopMedicineCardDto } from "@/lib/shop/types";

export default function ShopProductCard({ item }: { item: ShopMedicineCardDto }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleContinue() {
    const params = new URLSearchParams({
      id: item.id,
      name: item.name,
      category: item.categoryName,
      description: item.description,
      image: item.imageSrc,
      price: String(item.priceMonthly),
    });
    setOpen(false);
    router.push(`/shop/checkout?${params.toString()}`);
  }

  return (
    <>
      <article className="overflow-hidden rounded-[32px] border border-[#DCD2FF] bg-white p-3 shadow-sm">
        <div className="relative flex min-h-[190px] items-center justify-center overflow-hidden rounded-[24px] bg-[#F3EEFF] p-4">
          <img
            src="/curve-line.svg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <img
            src={item.imageSrc}
            alt={item.name}
            className="relative z-10 h-28 w-auto object-contain"
          />
        </div>

        {/* Content Area */}
        <div className="space-y-3 px-2 py-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-semibold text-[#2E00AB]">{item.name}</h3>
            <span className="shrink-0 rounded-full border border-[#2E00AB]/20 bg-[#F8F4FF] px-3 py-0.5 text-[11px] text-[#2E00AB]">
              {item.categoryName}
            </span>
          </div>
          <p className="line-clamp-2 min-h-[40px] text-sm text-[#2E00AB]/70">{item.description}</p>
          <p className="text-3xl font-bold leading-none text-[#2E00AB]">${item.priceMonthly}/mo</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-xl bg-[#2E00AB] py-3 text-sm font-semibold text-white transition hover:bg-[#2E00AB]/90"
          >
            View Details
          </button>
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] max-w-4xl gap-0 overflow-y-auto p-6 sm:rounded-[32px]">
          {/* Main 2-Column Grid spanning the entire height */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
            {/* LEFT SIDE: Unified Card spanning full vertical height */}
            <div className="flex flex-col rounded-[24px] border border-[#DCD2FF] bg-[#F8F4FF]/20 p-3 h-full justify-between">
              {/* Bottle Box: Stretches dynamically to consume maximum vertical area */}
              <div className="relative flex flex-1 min-h-[360px] items-center justify-center overflow-hidden rounded-[20px] bg-[#F3EEFF] p-6">
                <img
                  src="/curve-line.svg"
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
                />
                <img
                  src={item.imageSrc}
                  alt={item.name}
                  className="relative z-10 h-full max-h-[320px] w-auto object-contain drop-shadow-sm"
                />
              </div>

              {/* Anchored text at the bottom edge of the left card boundary */}
              <p className="mt-4 px-1 text-xl font-bold text-[#2E00AB]">
                From ${item.priceMonthly}/month
              </p>
            </div>

            {/* RIGHT SIDE: Details and Buttons nested together */}
            <div className="flex flex-col justify-between min-w-0 py-1">
              <div>
                <DialogTitle className="text-3xl font-bold text-[#2E00AB]">{item.name}</DialogTitle>
                <DialogDescription className="sr-only">
                  Detailed information about {item.name}
                </DialogDescription>

                <p className="mt-3 text-base text-[#2E00AB]/90 leading-relaxed">
                  {item.description}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#2E00AB]/80">
                  This treatment plan is personalized based on your health assessment and clinician
                  recommendations for safe and sustainable progress.
                </p>

                <div className="mt-6">
                  <h3 className="text-base font-bold text-[#2E00AB]">Important Information</h3>
                  <ul className="mt-3 space-y-2.5">
                    <li className="border-l-[3px] border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90">
                      Prescription required following clinical approval.
                    </li>
                    <li className="border-l-[3px] border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90">
                      Contact your provider if you experience unexpected side effects.
                    </li>
                    <li className="border-l-[3px] border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90">
                      Individual results may vary based on medical history and lifestyle.
                    </li>
                    <li className="border-l-[3px] border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90">
                      Use only as directed by your care team.
                    </li>
                  </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-[#2E00AB]/10 bg-[#F8F4FF]/60 p-4">
                  <h4 className="font-bold text-[#2E00AB] text-sm">Notice</h4>
                  <p className="mt-1 text-xs text-[#2E00AB]/80 leading-normal">
                    * Prescription required. Professional medical consultation necessary before
                    fulfillment.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Positioned directly inside the right column flow */}
              <div className="flex flex-col-reverse gap-3 mt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="w-full border-[#2E00AB]/30 text-[#2E00AB]  font-semibold sm:w-auto px-6 py-5"
                >
                  Explore More
                </Button>
                <Button
                  type="button"
                  onClick={handleContinue}
                  className="w-full bg-[#2E00AB] hover:bg-[#2E00AB]/90 text-white  font-semibold sm:w-auto px-6 py-5"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
