"use client";

import { useRouter } from "next/navigation";

export default function FooterButtons() {
  const router = useRouter();

  return (
    <div className="mt-auto flex shrink-0 flex-col-reverse gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between sm:pt-8">
      <button
        type="button"
        onClick={() => router.push("/onboarding/quiz")}
        className="w-full rounded-md border border-[#2E00AB]/40 px-6 py-3 text-base text-[#2E00AB] sm:w-auto sm:px-8"
      >
        ← Previous
      </button>

      <button
        type="button"
        onClick={() => router.push("/onboarding/select-plan")}
        className="w-full rounded-md bg-[#2E00AB] px-6 py-3 text-base text-white sm:w-auto sm:px-8"
      >
        Continue →
      </button>
    </div>
  );
}
