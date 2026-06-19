import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BodyInc · Patient Portal" },
      {
        name: "description",
        content: "Access your BodyInc patient account, appointments, and care plan.",
      },
      { property: "og:title", content: "BodyInc · Patient Portal" },
      {
        property: "og:description",
        content: "Access your BodyInc patient account, appointments, and care plan.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setAuthed(false);
      }
    });
  }, [navigate]);

  if (authed === null) {
    return <div className="flex min-h-screen items-center justify-center" />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <div className="max-w-lg">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          BodyInc Patient Portal
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Sign in to access your care plan, appointments, and provider messages.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/auth">Log in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth">Create account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
