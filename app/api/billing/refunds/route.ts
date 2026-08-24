import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchRefundRequests } from "@/lib/billing/service-data";
import { sendTransactionalEmail } from "@/lib/email/send";
import { refundRequestAdminEmail, refundRequestReceivedEmail } from "@/lib/email/lifecycle-emails";
import { adminNotifyEmail, appUrl, patientEmailByUserId } from "@/lib/email/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFUNDABLE_PAYMENT_STATUSES = ["succeeded", "paid"];

type Body = {
  paymentId?: string;
  reason?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const paymentId = body.paymentId?.trim();
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId is required." }, { status: 400 });
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id, amount_cents, currency, status, stripe_subscription_id")
    .eq("id", paymentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (!REFUNDABLE_PAYMENT_STATUSES.includes(payment.status)) {
    return NextResponse.json({ error: "Only paid transactions can be refunded." }, { status: 400 });
  }

  const { data: openRequest, error: openError } = await supabaseAdmin
    .from("refund_requests")
    .select("id")
    .eq("payment_id", payment.id)
    .eq("status", "pending")
    .maybeSingle();

  if (openError) {
    return NextResponse.json({ error: openError.message }, { status: 500 });
  }
  if (openRequest) {
    return NextResponse.json(
      { error: "A refund request is already pending for this payment." },
      { status: 409 },
    );
  }

  let subscriptionId: string | null = null;
  if (payment.stripe_subscription_id) {
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", payment.stripe_subscription_id)
      .maybeSingle();
    subscriptionId = subscription?.id ?? null;
  }

  const reason = body.reason?.trim() || null;

  const { error: insertError } = await supabaseAdmin.from("refund_requests").insert({
    user_id: user.id,
    payment_id: payment.id,
    subscription_id: subscriptionId,
    amount_cents: payment.amount_cents,
    reason,
    status: "pending",
  });

  if (insertError) {
    const duplicate = /duplicate|unique/i.test(insertError.message);
    return NextResponse.json(
      {
        error: duplicate
          ? "A refund request is already pending for this payment."
          : insertError.message,
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  try {
    const patient = await patientEmailByUserId(user.id);
    if (patient) {
      const currency = payment.currency || "usd";
      const { subject, html } = refundRequestReceivedEmail({
        fullName: patient.fullName,
        amountCents: payment.amount_cents,
        currency,
        billingUrl: `${appUrl()}/billing`,
      });
      await sendTransactionalEmail({ to: patient.email, subject, html });

      const adminTo = adminNotifyEmail();
      if (adminTo) {
        const adminMail = refundRequestAdminEmail({
          patientEmail: patient.email,
          patientName: patient.fullName,
          amountCents: payment.amount_cents,
          currency,
          reason,
          paymentId: payment.id,
        });
        await sendTransactionalEmail({
          to: adminTo,
          subject: adminMail.subject,
          html: adminMail.html,
        });
      }
    }
  } catch (err) {
    console.error("[email] refund request notify failed:", err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const refundRequests = await fetchRefundRequests(user.id);
    return NextResponse.json({ refundRequests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load refund requests." },
      { status: 500 },
    );
  }
}
