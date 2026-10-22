import { NextResponse } from "next/server";

import { EMAIL_TRANSPORT_HINT, isEmailTransportConfigured } from "@/lib/email/transport";
import { sendMissedOrderConfirmationEmails } from "@/lib/email/order-confirmation";
import { sendMissedAdminNewRequestEmails } from "@/lib/email/admin-request-email";
import { sendUnsentInquiryUpdateEmails } from "@/lib/email/inquiry-updates";
import {
  sendIncompleteOrderReminders,
  sendOrderStatusEmails,
  sendRefillReminders,
  sendTrackingIdEmails,
} from "@/lib/email/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let transportWarningLogged = false;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // A bad login makes every send fail and the claim get released, so the local
  // 15s poll would retry the same mail forever. Skip until credentials are valid.
  if (!isEmailTransportConfigured()) {
    if (!transportWarningLogged) {
      transportWarningLogged = true;
      console.warn(`[email] reminders skipped — ${EMAIL_TRANSPORT_HINT}`);
    }
    return NextResponse.json({ ok: true, skipped: "email transport not configured" });
  }

  try {
    // Immediate sends happen on payment / admin actions. This job is the daily backup
    // plus time-based mail (incomplete checkout after 24h, refill before renewal).
    const incompleteOrders = await sendIncompleteOrderReminders();
    const refills = await sendRefillReminders();
    const orderStatuses = await sendOrderStatusEmails();
    const trackingIds = await sendTrackingIdEmails();
    const orderConfirmations = await sendMissedOrderConfirmationEmails();
    const adminNewRequests = await sendMissedAdminNewRequestEmails();
    const inquiryUpdates = await sendUnsentInquiryUpdateEmails();
    return NextResponse.json({
      ok: true,
      incompleteOrders,
      refills,
      orderStatuses,
      trackingIds,
      orderConfirmations,
      adminNewRequests,
      inquiryUpdates,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reminder run failed." },
      { status: 500 },
    );
  }
}
