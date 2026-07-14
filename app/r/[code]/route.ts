import { NextResponse } from "next/server";

import { REFERRAL_COOKIE, resolveReferrerByCode } from "@/lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Referral landing link: /r/BODY-XXXXXXXX — remembers who sent the visitor,
// then drops them at the start of the funnel.
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/onboarding/goal", url.origin));

  const referrer = await resolveReferrerByCode(decodeURIComponent(code ?? "")).catch(() => null);
  if (referrer) {
    response.cookies.set(REFERRAL_COOKIE, decodeURIComponent(code), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}
