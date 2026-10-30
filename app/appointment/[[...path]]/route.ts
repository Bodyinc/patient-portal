import { NextRequest, NextResponse } from "next/server";
import { CONSULTATION_BRIDGE_SCRIPT } from "@/lib/consultations/bridge-script";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const pathString = path && path.length > 0 ? path.join("/") : "";
  let search = request.nextUrl.search; // includes ?token=...
  if (!request.nextUrl.searchParams.has("token")) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refUrl = new URL(referer);
        const refToken = refUrl.searchParams.get("token");
        if (refToken) {
          const sep = search ? "&" : "?";
          search = `${search}${sep}token=${encodeURIComponent(refToken)}`;
        }
      } catch {
        // Ignore invalid referer header
      }
    }
  }

  const quickbloxUrl = `https://client-bodyinc.quickblox.com/appointment${pathString ? `/${pathString}` : ""}${search}`;

  try {
    const upstreamRes = await fetch(quickbloxUrl, {
      headers: {
        "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    let html = await upstreamRes.text();
    // Strip <base href="/"> so internal router navigations stay on our same-origin proxy
    html = html.replace('<base href="/">', "");
    // Rewrite script, style, and icon tags to load directly from QuickBlox CDN
    html = html.replaceAll('src="', 'src="https://client-bodyinc.quickblox.com/');
    html = html.replaceAll('href="main.', 'href="https://client-bodyinc.quickblox.com/main.');
    html = html.replaceAll('href="favicon.', 'href="https://client-bodyinc.quickblox.com/favicon.');
    html = html.replaceAll('href="logo', 'href="https://client-bodyinc.quickblox.com/logo');
    html = html.replace(/<link[^>]*rel=["']manifest["'][^>]*>/gi, "");

    // Inject interceptor and bridge script right after <head>
    html = html.replace("<head>", `<head>${CONSULTATION_BRIDGE_SCRIPT}`);

    const headers = new Headers();
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self' http://localhost:* https://*.bodyinc.com https://*",
    );
    // Omit X-Frame-Options to allow embedding in our patient portal iframe

    return new NextResponse(html, {
      status: upstreamRes.status,
      headers,
    });
  } catch (error) {
    console.error("[appointment] failed to load consultation:", error);
    return new NextResponse("We couldn't load this consultation. Please refresh and try again.", {
      status: 502,
    });
  }
}
