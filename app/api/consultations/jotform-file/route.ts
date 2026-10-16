import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { fetchJotformUpload, isAllowedJotformUploadUrl } from "@/lib/consultations/jotform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "attachment";
  } catch {
    return "attachment";
  }
}

/**
 * Authenticated proxy for Jotform intake uploads so patients can open images/files
 * without exposing the Jotform API key to the browser.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing file URL." }, { status: 400 });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    decoded = rawUrl;
  }

  if (!isAllowedJotformUploadUrl(decoded)) {
    return NextResponse.json({ error: "File host is not allowed." }, { status: 400 });
  }

  try {
    const upstream = await fetchJotformUpload(decoded);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Unable to load that file from Jotform." },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const fileName = fileNameFromUrl(decoded);
    const isImage = contentType.startsWith("image/");
    const disposition = isImage
      ? `inline; filename="${fileName.replace(/"/g, "")}"`
      : `attachment; filename="${fileName.replace(/"/g, "")}"`;

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", disposition);
    headers.set("Cache-Control", "private, max-age=300");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.warn("[jotform-file] proxy failed:", error);
    return NextResponse.json({ error: "Unable to open that file." }, { status: 502 });
  }
}
