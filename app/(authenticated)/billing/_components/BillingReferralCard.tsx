"use client";

import { Gift, Users } from "lucide-react";
import { useState } from "react";

import type { ReferralSummary } from "@/lib/referrals";

type BillingReferralCardProps = {
  referral: ReferralSummary;
};

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function BillingReferralCard({ referral }: BillingReferralCardProps) {
  const [copied, setCopied] = useState<"idle" | "link" | "code" | "error">("idle");

  const copy = async (value: string, kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied("error");
    }
    window.setTimeout(() => setCopied("idle"), 1800);
  };

  return (
    <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-2xl font-semibold text-[#2E00AB]">Invite Friends & Earn Rewards</p>
          <p className="mt-1 max-w-xl text-sm text-[#2E00AB]/80">
            Share your link. When a friend starts a treatment plan, a{" "}
            {formatUsd(referral.rewardCents)} credit is added to your account and applies to your
            next bill automatically.
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#2E00AB]">
            <Gift className="h-4 w-4" />
            {formatUsd(referral.rewardCents)} Reward Credit per referral
          </p>
          {referral.invited > 0 ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-[#2E00AB]/80">
              <Users className="h-4 w-4" />
              {referral.converted} of {referral.invited} invited friend
              {referral.invited === 1 ? "" : "s"} joined · {formatUsd(referral.earnedCents)} earned
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="rounded-md border border-[#E5DFFF] bg-[#F7F4FF] px-3 py-2 text-xs font-medium text-[#2E00AB]">
            {referral.code}
          </span>
          <button
            type="button"
            onClick={() => copy(referral.code, "code")}
            className="rounded-md border border-[#D5CAFF] bg-white px-3 py-2 text-xs text-[#2E00AB]"
          >
            {copied === "code" ? "Copied" : copied === "error" ? "Copy failed" : "Copy Code"}
          </button>
          <button
            type="button"
            onClick={() => copy(referral.link, "link")}
            className="rounded-md bg-[#2E00AB] px-4 py-2 text-center text-xs font-medium text-white hover:bg-[#2E00AB]/90"
          >
            {copied === "link" ? "Link Copied ✓" : "Copy Invite Link"}
          </button>
        </div>
      </div>
    </section>
  );
}
