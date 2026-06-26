"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
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

  function signOut() {
    window.location.href = "/auth/signout";
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="flex w-[320px] flex-col justify-between rounded-[12px] bg-[#F3EFFF] p-6">
        <div>
          <Image src="/logo.svg" alt="BodyInc" width={160} height={50} priority />

          <div className="my-6 border-b border-[#DDD4FF]" />

          <nav className="mt-8 space-y-3">
            <div className="rounded-lg bg-[#E4DAFF] px-4 py-3 text-[24px] font-medium leading-none whitespace-nowrap text-[#2E00AB]">
              Dashboard
            </div>

            <div className="px-4 py-3 text-[24px] font-medium leading-none whitespace-nowrap text-[#2E00AB]">
              My Consultations
            </div>

            <div className="px-4 py-3 text-[24px] font-medium leading-none whitespace-nowrap text-[#2E00AB]">
              Shop
            </div>

            <div className="px-4 py-3 text-[24px] font-medium leading-none whitespace-nowrap text-[#2E00AB]">
              Intake Form
            </div>
          </nav>
        </div>

        <div>
          <div className="space-y-4">
            <div className="cursor-pointer px-4 text-[24px] font-medium leading-none text-[#2E00AB]">
              Settings
            </div>

            <div
              onClick={signOut}
              className="cursor-pointer px-4 text-[24px] font-medium leading-none text-[#2E00AB]"
            >
              Logout
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#F7F4FF] to-[#F3EEFF] px-8 py-6">
          <div>
            <h1 className="text-[42px] font-semibold leading-none text-[#2E00AB]">
              Good morning
              {profile?.full_name ? `, ${profile.full_name}` : ", James"}
            </h1>

            <p className="mt-3 text-[20px] font-normal leading-none text-[#2E00AB]">
              Here's an update on your health journey and upcoming treatment milestones.
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative">
              <Bell className="h-6 w-6 text-[#4F1DDB]" strokeWidth={1.8} />

              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
            </div>

            <div className="flex items-center gap-3">
              <img
                src="https://i.pravatar.cc/60"
                alt="Profile"
                className="h-[52px] w-[52px] rounded-lg object-cover"
              />

              <div>
                <p className="font-semibold text-[#4F1DDB]">
                  {profile?.full_name || "James Wilson"}
                </p>

                <p className="text-sm text-[#7B5CF1]">Patient ID: #BI-2048</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-5 lg:grid-cols-[2fr_1.4fr]">
          {/* Hero Card */}
          <div className="overflow-hidden rounded-xl border border-[#DDD4FF] bg-white">
            <div className="grid grid-cols-[420px_1fr]">
              {/* Left */}
              <div className="flex flex-col justify-center px-7 py-8">
                <div className="mb-5 inline-flex h-[36px] w-[140px] items-center rounded-md border border-[#DDD4FF] px-4 text-[16px] font-medium text-[#4F1DDB]">
                  Next Step
                </div>

                <h2 className="mb-6 text-[32px] font-bold leading-tight text-[#4F1DDB]">
                  Ready to Begin Your Treatment Journey?
                </h2>

                <p className="mb-8 text-[18px] leading-9 text-[#4F1DDB]">
                  Your lab work is now available. Schedule a clinician review to discuss your
                  results and receive personalized recommendations.
                </p>

                <Button className="h-[52px] w-fit rounded-lg bg-[#4F1DDB] px-7 text-[16px] hover:bg-[#4420C9]">
                  Complete Intake Form →
                </Button>
              </div>

              {/* Image */}
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

          {/* Message */}
          <div className="rounded-xl border border-[#DDD4FF] bg-white p-6">
            <h3 className="mb-6 text-[28px] font-bold text-[#4F1DDB]">Message</h3>

            <div className="space-y-4">
              <div className="rounded-xl border-l-4 border-[#4F1DDB] bg-[#F6F2FF] p-5">
                <div className="flex justify-between">
                  <p className="font-semibold text-[#4F1DDB]">Dr. Sarah Miller</p>

                  <p className="text-sm text-[#4F1DDB]">10:45 AM</p>
                </div>

                <p className="mt-3 text-[16px] text-[#4F1DDB]">
                  Your lab results are now available. Schedule your clinician review.
                </p>
              </div>

              <div className="rounded-xl border border-[#DDD4FF] p-5">
                <div className="flex justify-between">
                  <p className="font-semibold text-[#4F1DDB]">Nursing Support</p>

                  <p className="text-sm text-[#4F1DDB]">10:45 AM</p>
                </div>

                <p className="mt-3 text-[16px] text-[#4F1DDB]">
                  Your lab work has been processed successfully.
                </p>
              </div>

              <Button
                variant="outline"
                className="mt-5 h-[48px] rounded-lg border-[#4F1DDB] px-6 text-[#4F1DDB]"
              >
                View all messages →
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
