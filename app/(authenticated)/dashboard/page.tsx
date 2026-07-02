"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import DashboardHeader from "../_components/DashboardHeader";

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
    <main className="min-w-0 flex-1 p-3">
      <DashboardHeader fullName={profile?.full_name} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1.4fr]">
        <div className="overflow-hidden rounded-xl border border-[#DDD4FF] bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="flex flex-col justify-center px-4 py-5 sm:px-6 sm:py-6">
              <div className="mb-3 inline-flex h-[29px] w-[112px] items-center rounded-md border border-[#DDD4FF] px-3 text-sm font-medium text-[#4F1DDB] sm:mb-4">
                Next Step
              </div>

              <h2 className="mb-4 text-xl font-bold leading-tight text-[#4F1DDB] sm:mb-5 sm:text-[26px]">
                Ready to Begin Your Treatment Journey?
              </h2>

              <p className="mb-5 text-sm leading-relaxed text-[#4F1DDB] sm:mb-6 sm:text-sm sm:leading-7">
                Your lab work is now available. Schedule a clinician review to discuss your results
                and receive personalized recommendations.
              </p>

              <Button className="h-[42px] w-full rounded-lg bg-[#4F1DDB] px-6 text-sm hover:bg-[#4420C9] sm:w-fit">
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

        {/*   */}
      </div>
    </main>
  );
}
