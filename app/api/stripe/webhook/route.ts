import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { handleStripeEvent } from "@/lib/stripe/webhook-handlers";
import type { Json } from "@/lib/supabase/types";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature verification failed." },
      { status: 400 },
    );
  }

  // Idempotency: stripe_event_id is UNIQUE, so a duplicate delivery is a no-op.
  const { error: insertError } = await supabaseAdmin.from("stripe_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    payload: event as unknown as Json,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Handler failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
