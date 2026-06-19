import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · BodyInc Patient" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const router = useRouter();

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, dob")
        .maybeSingle();
      return data;
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">BodyInc · Patient</h1>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your patient portal is set up. We'll build out your features here next.
          </p>
        </div>
      </main>
    </div>
  );
}
