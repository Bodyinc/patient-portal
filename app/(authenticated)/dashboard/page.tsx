"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import DashboardHeader from "../_components/DashboardHeader";
import DashboardShell from "../_components/DashboardShell";

export default function DashboardPage() {
  const supabase = createClient();

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, dob")
        .maybeSingle();
      return data as { full_name: string; phone: string | null; dob: string | null } | null;
    },
  });

  return (
    <DashboardShell>
      <main className="min-w-0 flex-1 p-3 sm:p-4">
        <DashboardHeader fullName={profile?.full_name} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1.4fr]">
          <div className="overflow-hidden rounded-xl border border-[#DDD4FF] bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="flex flex-col justify-center px-5 py-6 sm:px-7 sm:py-8">
                <div className="mb-4 inline-flex h-[36px] w-[140px] items-center rounded-md border border-[#DDD4FF] px-4 text-[16px] font-medium text-[#4F1DDB] sm:mb-5">
                  Next Step
                </div>

                <h2 className="mb-4 text-2xl font-bold leading-tight text-[#4F1DDB] sm:mb-6 sm:text-[32px]">
                  Ready to Begin Your Treatment Journey?
                </h2>

                <p className="mb-6 text-base leading-relaxed text-[#4F1DDB] sm:mb-8 sm:text-[18px] sm:leading-9">
                  Your lab work is now available. Schedule a clinician review to discuss your
                  results and receive personalized recommendations.
                </p>

                <Button className="h-[52px] w-full rounded-lg bg-[#4F1DDB] px-7 text-[16px] hover:bg-[#4420C9] sm:w-fit">
                  Complete Intake Form →
                </Button>
              </div>

              <div className="overflow-hidden">
                <Image
                  src="/patient-image.svg"
                  alt="Patient"
                  width={700}
                  height={520}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDD4FF] bg-white p-4 sm:p-6">
            <h3 className="mb-4 text-2xl font-bold text-[#4F1DDB] sm:mb-6 sm:text-[28px]">
              Message
            </h3>

            <div className="space-y-4">
              <div className="rounded-xl border-l-4 border-[#4F1DDB] bg-[#F6F2FF] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-[#4F1DDB]">Dr. Sarah Miller</p>
                  <p className="text-sm text-[#4F1DDB]">10:45 AM</p>
                </div>

                <p className="mt-3 text-[16px] text-[#4F1DDB]">
                  Your lab results are now available. Schedule your clinician review.
                </p>
              </div>

              <div className="rounded-xl border border-[#DDD4FF] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-[#4F1DDB]">Nursing Support</p>
                  <p className="text-sm text-[#4F1DDB]">10:45 AM</p>
                </div>

                <p className="mt-3 text-[16px] text-[#4F1DDB]">
                  Your lab work has been processed successfully.
                </p>
              </div>

              <Button
                variant="outline"
                className="mt-5 h-[48px] w-full rounded-lg border-[#4F1DDB] px-6 text-[#4F1DDB] sm:w-auto"
              >
                View all messages →
              </Button>
            </div>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
