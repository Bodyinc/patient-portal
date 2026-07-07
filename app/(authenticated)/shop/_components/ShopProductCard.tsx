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
        {/* Changed to rounded-[24px] to curve all four corners of the purple box */}
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
        <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-y-auto p-0 sm:rounded-2xl">
          <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-4">
              <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-[#F3EEFF]">
                <img
                  src="/curve-line.svg"
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
                />
                <img
                  src={item.imageSrc}
                  alt={item.name}
                  className="relative z-10 h-auto max-h-[180px] w-auto object-contain"
                />
              </div>
              <p className="text-center text-2xl font-semibold text-[#2E00AB] sm:text-left">
                From ${item.priceMonthly}/month
              </p>
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-2xl font-semibold text-[#2E00AB] sm:text-3xl">
                {item.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detailed information about {item.name}
              </DialogDescription>

              <p className="mt-3 text-base text-[#2E00AB]">{item.description}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#2E00AB]/80 sm:text-base">
                This treatment plan is personalized based on your health assessment and clinician
                recommendations for safe and sustainable progress.
              </p>

              <div className="mt-5">
                <h3 className="text-base font-semibold text-[#2E00AB]">Important Information</h3>
                <ul className="mt-3 space-y-2">
                  <li className="border-l-4 border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90 sm:text-base">
                    Prescription required following clinical approval.
                  </li>
                  <li className="border-l-4 border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90 sm:text-base">
                    Contact your provider if you experience unexpected side effects.
                  </li>
                  <li className="border-l-4 border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90 sm:text-base">
                    Individual results may vary based on medical history and lifestyle.
                  </li>
                  <li className="border-l-4 border-[#2E00AB] pl-3 text-sm text-[#2E00AB]/90 sm:text-base">
                    Use only as directed by your care team.
                  </li>
                </ul>
              </div>

              <div className="mt-5 rounded-xl border border-[#2E00AB]/20 bg-[#F8F4FF] p-4">
                <h4 className="font-semibold text-[#2E00AB]">Notice</h4>
                <p className="mt-1 text-sm text-[#2E00AB]/80">
                  Prescription required. Professional medical consultation necessary before
                  fulfillment.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#2E00AB]/10 bg-white p-4 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full border-[#2E00AB]/40 text-[#2E00AB] sm:w-auto"
            >
              Explore More
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              className="w-full bg-[#2E00AB] hover:bg-[#2E00AB]/90 sm:w-auto"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
