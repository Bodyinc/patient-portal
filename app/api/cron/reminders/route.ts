import { NextResponse } from "next/server";

import { sendIncompleteOrderReminders, sendRefillReminders } from "@/lib/email/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const incompleteOrders = await sendIncompleteOrderReminders();
    const refills = await sendRefillReminders();
    return NextResponse.json({ ok: true, incompleteOrders, refills });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reminder run failed." },
      { status: 500 },
    );
  }
}
