import { NextResponse } from "next/server";

import { resolveIntakeSession, setSessionTokenCookie } from "@/lib/intake/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing point for "finish your order" reminder emails: restores the intake session
// cookie from the emailed token, so checkout resumes even in a fresh browser.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/onboarding/goal", url.origin));
  }

  const { session } = await resolveIntakeSession(token);
  if (!session) {
    return NextResponse.redirect(new URL("/onboarding/goal", url.origin));
  }

  await setSessionTokenCookie(token);
  const target = session.selected_plan_id
    ? "/onboarding/billing-checkout"
    : "/onboarding/select-plan";
  return NextResponse.redirect(new URL(target, url.origin));
}
