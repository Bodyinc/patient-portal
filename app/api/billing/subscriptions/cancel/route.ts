import { NextResponse } from "next/server";

import {
  CANCELLATION_REASON_IDS,
  STRIPE_CANCELLATION_FEEDBACK,
  cancellationReasonLabel,
  type CancellationReasonId,
} from "@/lib/billing/cancel-reasons";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/stripe/subscriptions";
import { sendTransactionalEmail } from "@/lib/email/send";
import { cancellationScheduledEmail } from "@/lib/email/lifecycle-emails";
import { markEmailSent, wasEmailSent } from "@/lib/email/idempotency";
import { appUrl, patientEmailByUserId } from "@/lib/email/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

type Body = {
  subscriptionId?: string;
  reasons?: string[];
  otherText?: string | null;
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

  const { subscriptionId, reasons, otherText } = body;
  if (!subscriptionId) {
    return NextResponse.json({ error: "subscriptionId is required." }, { status: 400 });
  }

  if (!reasons?.length) {
    return NextResponse.json(
      { error: "At least one cancellation reason is required." },
      { status: 400 },
    );
  }

  const validReasons = reasons.filter((reason) =>
    CANCELLATION_REASON_IDS.includes(reason as (typeof CANCELLATION_REASON_IDS)[number]),
  );
  if (validReasons.length === 0) {
    return NextResponse.json({ error: "Invalid cancellation reasons." }, { status: 400 });
  }

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, stripe_subscription_id, status, cancel_at_period_end, current_period_end, medicine_id",
    )
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }
  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }
  if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
    return NextResponse.json({ error: "This subscription is not active." }, { status: 400 });
  }
  if (subscription.cancel_at_period_end) {
    return NextResponse.json(
      { error: "This subscription is already scheduled for cancellation." },
      { status: 400 },
    );
  }

  const trimmedOther = otherText?.trim() || null;
  const reasonLabels = validReasons.map(cancellationReasonLabel).join("; ");
  const comment = trimmedOther ? `${reasonLabels} — ${trimmedOther}` : reasonLabels;
  const feedback = STRIPE_CANCELLATION_FEEDBACK[
    validReasons[0] as CancellationReasonId
  ] as Stripe.SubscriptionUpdateParams.CancellationDetails["feedback"];

  try {
    const updated = await cancelSubscriptionAtPeriodEnd(subscription.stripe_subscription_id, {
      feedback,
      comment,
    });

    const { error: feedbackError } = await supabaseAdmin
      .from("subscription_cancellation_feedback")
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        reasons: validReasons,
        other_text: otherText?.trim() || null,
      });

    if (feedbackError) {
      return NextResponse.json({ error: feedbackError.message }, { status: 500 });
    }

    const periodEndTs =
      (updated as { current_period_end?: number }).current_period_end ??
      updated.items?.data?.[0]?.current_period_end;
    const currentPeriodEnd = periodEndTs
      ? new Date(periodEndTs * 1000).toISOString()
      : subscription.current_period_end;

    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        current_period_end: currentPeriodEnd,
      })
      .eq("id", subscription.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    void (async () => {
      const stripeSubId = subscription.stripe_subscription_id;
      if (!stripeSubId || (await wasEmailSent("cancellation_scheduled", stripeSubId))) return;
      const patient = await patientEmailByUserId(user.id);
      if (!patient) return;
      let medicineName: string | null = null;
      if (subscription.medicine_id) {
        const { data: med } = await supabaseAdmin
          .from("medicines")
          .select("name")
          .eq("id", subscription.medicine_id)
          .maybeSingle();
        medicineName = med?.name ?? null;
      }
      const { subject, html } = cancellationScheduledEmail({
        fullName: patient.fullName,
        medicineName,
        periodEnd: currentPeriodEnd,
        billingUrl: `${appUrl()}/billing`,
      });
      if (await sendTransactionalEmail({ to: patient.email, subject, html })) {
        await markEmailSent("cancellation_scheduled", stripeSubId);
      }
    })().catch((err) => {
      console.error("[email] cancel subscription notify failed:", err);
    });

    return NextResponse.json({
      ok: true,
      currentPeriodEnd,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cancel subscription." },
      { status: 500 },
    );
  }
}
