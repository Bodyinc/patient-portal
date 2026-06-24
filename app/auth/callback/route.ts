import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  console.log("CALLBACK URL:", request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  console.log("CODE:", code);
  console.log("NEXT:", next);

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    console.log("EXCHANGE ERROR:", error);

    if (!error) {
      const safeNext = next.startsWith("/") ? next : "/dashboard";

      console.log("REDIRECTING TO:", safeNext);

      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  console.log("FAILED → REDIRECTING TO LOGIN");

  return NextResponse.redirect(`${origin}/auth?error=auth_callback`);
}