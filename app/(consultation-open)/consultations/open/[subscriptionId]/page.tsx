"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";

import { startConsultation } from "@/lib/consultations/actions";

type OpenConsultationPageProps = {
  params: Promise<{ subscriptionId: string }>;
};

export default function OpenConsultationPage({ params }: OpenConsultationPageProps) {
  const { subscriptionId } = use(params);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startConsultation(subscriptionId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          window.location.replace(result.embedUrl);
          return;
        }
        setMessage(result.message);
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to start your consultation right now. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [subscriptionId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <Image src="/logo.svg" alt="BodyInc" width={120} height={36} priority />
      <p className="max-w-md text-sm leading-relaxed text-[#152A51]">
        {message ?? "Opening your consultation…"}
      </p>
      {message ? (
        <Link
          href="/consultations"
          className="text-sm font-medium text-[#152A51] underline underline-offset-2"
        >
          Back to Consultations
        </Link>
      ) : null}
    </main>
  );
}
