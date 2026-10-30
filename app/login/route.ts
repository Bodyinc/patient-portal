import { NextRequest, NextResponse } from "next/server";
import { CONSULTATION_BRIDGE_SCRIPT } from "@/lib/consultations/bridge-script";

export async function GET(request: NextRequest) {
  const quickbloxUrl = `https://client-bodyinc.quickblox.com/login${request.nextUrl.search}`;

  try {
    const upstreamRes = await fetch(quickbloxUrl, {
      headers: {
        "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    let html = await upstreamRes.text();
    html = html.replace('<base href="/">', "");
    html = html.replaceAll('src="', 'src="https://client-bodyinc.quickblox.com/');
    html = html.replaceAll('href="main.', 'href="https://client-bodyinc.quickblox.com/main.');
    html = html.replaceAll('href="favicon.', 'href="https://client-bodyinc.quickblox.com/favicon.');
    html = html.replace(/<link[^>]*rel=["']manifest["'][^>]*>/gi, "");

    html = html.replace("<head>", `<head>${CONSULTATION_BRIDGE_SCRIPT}`);

    const headers = new Headers();
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self' http://localhost:* https://*.bodyinc.com https://*",
    );

    return new NextResponse(html, {
      status: upstreamRes.status,
      headers,
    });
  } catch (error) {
    console.error("[login] failed to load login page:", error);
    return new NextResponse("We couldn't load the login page. Please refresh and try again.", {
      status: 502,
    });
  }
}
