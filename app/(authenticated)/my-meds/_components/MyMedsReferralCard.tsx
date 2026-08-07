"use client";

import { Gift } from "lucide-react";
import { useState } from "react";

type MyMedsReferralCardProps = {
  referralCode: string;
  referralLink: string;
  rewardCents: number;
};

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function MyMedsReferralCard({
  referralCode,
  referralLink,
  rewardCents,
}: MyMedsReferralCardProps) {
  const [copied, setCopied] = useState<"idle" | "code" | "link" | "error">("idle");

  const handleCopy = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied("error");
    }

    window.setTimeout(() => setCopied("idle"), 1800);
  };

  return (
    <section className="rounded-[16px] border border-[#E8EEED] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <p className="text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
            Referral Program
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#152A51]/80 sm:text-[15px]">
            Share your wellness journey with friends and family. Earn credits towards your next
            prescription for every successful referral.
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#152A51]">
            <Gift className="h-4 w-4 text-[#6A9B9C]" />
            {formatUsd(rewardCents)} Reward Credit per referral
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleCopy(referralLink || referralCode, "link")}
          className="h-10 w-full shrink-0 rounded-full bg-[#152A51] px-5 text-center text-sm font-medium text-white hover:bg-[#152A51]/90 sm:w-auto"
        >
          {copied === "link"
            ? "Link Copied ✓"
            : copied === "error"
              ? "Copy failed"
              : "Copy Invite Link"}
        </button>
      </div>
    </section>
  );
}
