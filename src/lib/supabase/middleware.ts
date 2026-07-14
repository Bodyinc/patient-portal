import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGuestRedirectPath, isProtectedPath } from "@/lib/auth/constants";
import type { Database } from "./types";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  sessionResponse: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url);
  copyCookies(sessionResponse, redirectResponse);
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/onboarding")) {
    return supabaseResponse;
  }

  // Middleware only routes; pages re-verify with getUser(). Reading the session from
  // the cookie is local and free — we only hit the auth server when the access token
  // is missing/near expiry (which also refreshes the cookie).
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let user = session?.user ?? null;
  const expiresAtMs = (session?.expires_at ?? 0) * 1000;
  if (session && expiresAtMs - Date.now() < 60_000) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (isProtectedPath(pathname) && !user) {
    return redirectWithCookies(request, "/auth", supabaseResponse);
  }

  if (isGuestRedirectPath(pathname) && user) {
    // Verify for real before bouncing a "logged-in" visitor away from /auth — a
    // deactivated/deleted account still carries a locally-valid cookie, and trusting
    // it here would ping-pong them between /auth and /dashboard until it expires.
    // Guest pages are rare navigations, so the extra auth call is cheap.
    const { data: verified } = await supabase.auth.getUser();
    if (verified.user) {
      return redirectWithCookies(request, "/dashboard", supabaseResponse);
    }
  }

  return supabaseResponse;
}
