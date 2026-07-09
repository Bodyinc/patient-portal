"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { useState } from "react";

type MyMedsReferralCardProps = {
  referralCode: string;
};

export default function MyMedsReferralCard({ referralCode }: MyMedsReferralCardProps) {
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-2xl font-semibold text-[#2E00AB]">Referral Program</p>
          <p className="mt-1 max-w-xl text-sm text-[#2E00AB]/80">
            Share your wellness journey with friends and family. Earn credits towards your next
            prescription for every successful referral.
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#2E00AB]">
            <Gift className="h-4 w-4" />
            $50 Reward Credit per referral
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="rounded-md border border-dashed border-[#D5CAFF] bg-[#F7F4FF] px-3 py-2 text-xs font-medium text-[#2E00AB]">
            {referralCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-[#D5CAFF] bg-white px-3 py-2 text-xs text-[#2E00AB]"
          >
            {copied === "success" ? "Copied" : copied === "error" ? "Copy failed" : "Copy Code"}
          </button>
          <Link
            href="/shop"
            className="rounded-md bg-[#2E00AB] px-4 py-2 text-center text-xs font-medium text-white hover:bg-[#2E00AB]/90"
          >
            Refer Friends →
          </Link>
        </div>
      </div>
    </section>
  );
}
