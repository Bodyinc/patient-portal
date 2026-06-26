"use client";

import { useRouter } from "next/navigation";

export default function FooterButtons() {
  const router = useRouter();

  return (
    <div className="flex justify-between items-center mt-16">
      <button
        onClick={() => router.push("/onboarding/select-medication")}
        className="border border-[#2E00AB] text-[#2E00AB] px-6 py-3 rounded-lg"
      >
        ← Previous
      </button>

      <button
        onClick={() => router.push("/onboarding/billing-checkout")}
        className="bg-[#2E00AB] text-white px-8 py-3 rounded-lg"
      >
        Continue →
      </button>
    </div>
  );
}
