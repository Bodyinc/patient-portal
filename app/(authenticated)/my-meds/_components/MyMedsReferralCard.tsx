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
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
            Referral Program
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#152A51]/80 sm:text-[15px]">
            Share your wellness journey with friends and family. Earn credits towards your next
            prescription for every successful referral.
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#152A51]">
            <Gift className="h-4 w-4 text-[#6A9B9C]" />
            {formatUsd(rewardCents)} Reward Credit per referral
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* <span className="rounded-full border border-dashed border-[#E8EEED] bg-[#F3F6F6] px-4 py-2 text-xs font-medium text-[#152A51]">
            {referralCode}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(referralCode, "code")}
            className="h-10 rounded-full border border-[#E8EEED] bg-white px-4 text-xs font-medium text-[#152A51] hover:bg-[#F3F6F6]"
          >
            {copied === "code" ? "Copied" : copied === "error" ? "Copy failed" : "Copy Code"}
          </button> */}
          <button
            type="button"
            onClick={() => handleCopy(referralLink, "link")}
            className="h-10 rounded-full bg-[#152A51] px-5 text-center text-xs font-medium text-white hover:bg-[#152A51]/90"
          >
            {copied === "link" ? "Link Copied ✓" : "Copy Invite Link"}
          </button>
        </div>
      </div>
    </section>
  );
}
