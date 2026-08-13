"use client";

import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatFromPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import MedicineProductImage from "./MedicineProductImage";

type MedicationDetailsLayoutProps = {
  name: string;
  description: string;
  detailDescription?: string | null;
  imageSrc: string | null | undefined;
  fromPriceCents: number | null;
  /** Variant select control — pass existing select markup; no logic changes. */
  variantSelect?: ReactNode;
  /** Admin-provided important info from medicine record. */
  importantInfo?: string[];
  /** Admin-provided notice from medicine record. */
  notice?: string | null;
  importantOpen: boolean;
  onImportantOpenChange: (open: boolean) => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  onExploreMore: () => void;
  onContinue: () => void;
  className?: string;
};

const DETAILS_GRID = "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-start";

function formatNotice(notice: string) {
  const trimmed = notice.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("*") || trimmed.startsWith("Note:")) return trimmed;
  return `* ${trimmed}`;
}

function ImportantInfoPanel({ items, notice }: { items: string[]; notice: string }) {
  return (
    <div className="border-t border-[#152A51]/10 px-4 pb-4 pt-3">
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-[14px] leading-snug text-[#152A51]"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#152A51]" strokeWidth={2.5} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? (
        <div
          className={cn(
            "rounded-[14px] border border-[#E8EEED] bg-[#F3F6F6] p-4",
            items.length > 0 && "mt-4",
          )}
        >
          <h4 className="text-[13px] font-medium text-[#152A51]">Notice</h4>
          <p className="mt-1 text-[12px] leading-normal text-[#152A51]/80">{notice}</p>
        </div>
      ) : null}
    </div>
  );
}

/** Figma medication details popup — shared by shop + onboarding. Style only. */
export default function MedicationDetailsLayout({
  name,
  description,
  detailDescription,
  imageSrc,
  fromPriceCents,
  variantSelect,
  importantInfo,
  notice,
  importantOpen,
  onImportantOpenChange,
  continueLabel = "Continue",
  continueDisabled = false,
  onExploreMore,
  onContinue,
  className,
}: MedicationDetailsLayoutProps) {
  const infoItems = (importantInfo ?? []).map((item) => item.trim()).filter(Boolean);
  const noticeText = notice?.trim() ? formatNotice(notice) : "";
  const hasImportantPanel = infoItems.length > 0 || Boolean(noticeText);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="overflow-visible rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-5">
        <div className={DETAILS_GRID}>
          <MedicineProductImage
            src={imageSrc}
            alt={name}
            frameClassName="overflow-hidden rounded-[20px] bg-[#E8EEED]"
            className="mx-auto w-full max-w-[300px] lg:mx-0"
          />

          <div className="flex min-w-0 flex-col">
            <DialogTitle className="text-[28px] font-medium leading-tight tracking-[-0.5px] text-[#152A51] sm:text-[32px]">
              {name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detailed information about {name}
            </DialogDescription>

            {description ? (
              <p className="mt-4 text-[15px] leading-relaxed text-[#152A51]">{description}</p>
            ) : null}
            {detailDescription ? (
              <p className="mt-3 text-[14px] leading-relaxed text-[#152A51]/80">
                {detailDescription}
              </p>
            ) : null}

            {variantSelect ? <div className="mt-5 max-w-xs">{variantSelect}</div> : null}

            <p className="mt-5 text-[22px] font-medium tracking-[-0.3px] text-[#152A51] sm:text-[24px]">
              {formatFromPrice(fromPriceCents)}
            </p>

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-start">
              <Button
                type="button"
                variant="outline"
                onClick={onExploreMore}
                className="h-[46px] w-full rounded-full border-[#152A51]/30 bg-transparent px-6 text-[14px] font-medium text-[#152A51] shadow-none hover:bg-[#152A51]/5 sm:w-auto"
              >
                Explore More
              </Button>
              <Button
                type="button"
                onClick={onContinue}
                disabled={continueDisabled}
                className={cn(
                  "h-[46px] w-full rounded-full px-6 text-[14px] font-medium shadow-none sm:w-auto",
                  continueDisabled
                    ? "bg-[#E8EEED] text-[#152A51]/50"
                    : "bg-[#E3E084] text-[#152A51] hover:bg-[#D9D674]",
                )}
              >
                {continueLabel}
              </Button>
            </div>

            {hasImportantPanel ? (
              <div className="relative mt-6">
                <button
                  type="button"
                  onClick={() => onImportantOpenChange(!importantOpen)}
                  aria-expanded={importantOpen}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 bg-[#E8EEED] px-4 py-3 text-left",
                    importantOpen ? "rounded-t-[14px]" : "rounded-[14px]",
                  )}
                >
                  <span className="text-[15px] font-medium text-[#152A51]">
                    Important Information
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-[#152A51] transition-transform duration-200",
                      importantOpen && "rotate-180",
                    )}
                  />
                </button>

                {importantOpen ? (
                  <div className="absolute left-0 right-0 top-full z-20 overflow-hidden rounded-b-[14px] bg-[#E8EEED]">
                    <ImportantInfoPanel items={infoItems} notice={noticeText} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {importantOpen && hasImportantPanel ? (
        <div className={cn(DETAILS_GRID, "pointer-events-none invisible")} aria-hidden>
          <div className="hidden lg:block" />
          <ImportantInfoPanel items={infoItems} notice={noticeText} />
        </div>
      ) : null}
    </div>
  );
}
