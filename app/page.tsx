import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
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
            <Link href="/auth">Log in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
