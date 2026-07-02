"use client";

import { useState } from "react";

type ShopReferralCardProps = {
  referralCode: string;
};

export default function ShopReferralCard({ referralCode }: ShopReferralCardProps) {
  const [copied, setCopied] = useState<"idle" | "success" | "error">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied("success");
    } catch {
      setCopied("error");
    }

    window.setTimeout(() => setCopied("idle"), 1800);
  };

  return (
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-semibold text-[#2E00AB]">Invite Friends & Earn Rewards</p>
          <p className="mt-1 max-w-xl text-sm text-[#2E00AB]/80">
            Share your wellness journey with friends and family. Earn credits towards your next
            prescription for every successful referral.
          </p>
          <p className="mt-2 text-sm font-semibold text-[#2E00AB]">
            $50 Reward Credit per referral
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span className="rounded-md border border-[#E5DFFF] bg-[#F7F4FF] px-3 py-2 text-xs font-medium text-[#2E00AB]">
            {referralCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-[#D5CAFF] bg-white px-3 py-2 text-xs text-[#2E00AB]"
          >
            {copied === "success" ? "Copied" : copied === "error" ? "Copy failed" : "Copy Code"}
          </button>
        </div>
      </div>
    </section>
  );
}
