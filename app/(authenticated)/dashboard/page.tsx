"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
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

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 border-r bg-white p-6">
        <h1 className="mb-8 text-xl font-bold">BodyInc</h1>
        <nav className="space-y-4">
          <div className="cursor-pointer rounded p-2 hover:bg-gray-100">Dashboard</div>
          <div className="cursor-pointer rounded p-2 hover:bg-gray-100">Progress Tracking</div>
          <div className="cursor-pointer rounded p-2 hover:bg-gray-100">Appointments</div>
          <div className="cursor-pointer rounded p-2 hover:bg-gray-100">Messages</div>
          <div className="cursor-pointer rounded p-2 hover:bg-gray-100">Treatment Plan</div>
          <div className="cursor-pointer rounded p-2 hover:bg-gray-100">Settings</div>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">
              Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
            </h2>
            <p className="text-gray-500">Here is your health overview for today.</p>
          </div>
          <div className="flex gap-3">
            <Button>Book Appointment</Button>
            <Button variant="outline">Send Message</Button>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">Upcoming Appointment</div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">Treatment Progress</div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">Messages</div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">Health Score</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="mb-4 font-semibold">Progress Overview</h3>
            <div className="h-64 rounded bg-gray-100" />
          </div>
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold">Recent Activity</h3>
            <div className="space-y-3">
              <div className="h-10 rounded bg-gray-100" />
              <div className="h-10 rounded bg-gray-100" />
              <div className="h-10 rounded bg-gray-100" />
              <div className="h-10 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
