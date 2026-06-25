import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  const isPasswordReset = safeNext === "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination = isPasswordReset ? `${safeNext}?recovery=1` : safeNext;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  if (isPasswordReset) {
    return NextResponse.redirect(`${origin}/reset-password?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_callback`);
}
