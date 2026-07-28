import { appendFileSync, mkdirSync } from "fs";
import { NextResponse } from "next/server";
import path from "path";

const LOG_PATH = path.join(process.cwd(), ".cursor", "debug-470da1.log");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, `${JSON.stringify({ ...body, timestamp: Date.now() })}\n`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
