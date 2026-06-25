"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

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
      <aside className="flex w-64 flex-col justify-between bg-[#F5F1FF] p-6">
        <div>
          <Image src="/logo.svg" alt="BodyInc" width={160} height={50} priority />

          <div className="my-6 border-b border-[#DDD4FF]" />

          <nav className="space-y-2">
            <div className="rounded-lg bg-[#E4DAFF] px-4 py-3 font-medium text-[#4F1DDB]">
              Dashboard
            </div>

            <div className="px-4 py-3 text-[#4F1DDB]">My Consultations</div>

            <div className="px-4 py-3 text-[#4F1DDB]">Shop</div>

            <div className="px-4 py-3 text-[#4F1DDB]">Intake Form</div>
          </nav>
        </div>

        <div>
          <div className="mb-4 border-b border-[#DDD4FF]" />

          <div className="space-y-3">
            <div className="cursor-pointer text-[#4F1DDB]">Settings</div>

            <div onClick={signOut} className="cursor-pointer text-[#4F1DDB]">
              Logout
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-3">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#F5F1FF] to-[#F0EAFF] p-5">
          <div>
            <h1 className="text-4xl font-bold text-[#4F1DDB]">
              Good morning
              {profile?.full_name ? `, ${profile.full_name}` : ", James"}
            </h1>

            <p className="mt-2 text-[#4F1DDB]">
              Here's an update on your health journey and upcoming treatment milestones.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xl text-[#4F1DDB]">🔔</div>

            <div className="flex items-center gap-3">
              <img src="https://i.pravatar.cc/60" className="h-12 w-12 rounded-lg" />

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
        <div className="grid gap-4 lg:grid-cols-[2fr_1.5fr]">
          {/* Hero Card */}
          <div className="overflow-hidden rounded-xl border border-[#DDD4FF] bg-white">
            <div className="grid md:grid-cols-2">
              <div className="flex flex-col justify-center p-6">
                <div className="mb-4 inline-block rounded border border-[#DDD4FF] px-3 py-1 text-sm text-[#4F1DDB]">
                  Next Step
                </div>

                <h2 className="mb-4 text-3xl font-bold text-[#4F1DDB]">
                  Ready to Begin Your Treatment Journey?
                </h2>

                <p className="mb-6 text-[#4F1DDB]">
                  Your lab work is now available. Schedule a clinician review to discuss your
                  results and receive personalized recommendations.
                </p>

                <Button className="w-fit bg-[#4F1DDB] hover:bg-[#4420c9]">
                  Complete Intake Form →
                </Button>
              </div>

              <Image
                src="/patient-image.svg"
                alt="Patient"
                width={600}
                height={500}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Messages */}
          <div className="rounded-xl border border-[#DDD4FF] bg-white p-5">
            <h3 className="mb-4 text-2xl font-semibold text-[#4F1DDB]">Message</h3>

            <div className="space-y-3">
              <div className="rounded-lg border-l-4 border-[#4F1DDB] bg-[#F5F1FF] p-4">
                <div className="flex justify-between">
                  <p className="font-semibold text-[#4F1DDB]">Dr. Sarah Miller</p>

                  <p className="text-sm text-[#4F1DDB]">10:45 AM</p>
                </div>

                <p className="mt-2 text-sm text-[#4F1DDB]">
                  Your lab results are now available. Schedule your clinician review.
                </p>
              </div>

              <div className="rounded-lg border border-[#DDD4FF] p-4">
                <div className="flex justify-between">
                  <p className="font-semibold text-[#4F1DDB]">Nursing Support</p>

                  <p className="text-sm text-[#4F1DDB]">10:45 AM</p>
                </div>

                <p className="mt-2 text-sm text-[#4F1DDB]">
                  Your lab work has been processed successfully.
                </p>
              </div>

              <Button variant="outline" className="mt-3 border-[#4F1DDB] text-[#4F1DDB]">
                View all messages →
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
