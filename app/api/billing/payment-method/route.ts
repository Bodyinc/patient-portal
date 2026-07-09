import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customers";
import { createSetupIntent, setDefaultPaymentMethod } from "@/lib/stripe/payment-methods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };

  const customerId = await getOrCreateStripeCustomer({
    userId: user.id,
    email: user.email ?? null,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
  });
  return { user, customerId };
}

export async function POST() {
  const result = await requireCustomer();
  if ("error" in result) return result.error;

  try {
    const clientSecret = await createSetupIntent(result.customerId);
    return NextResponse.json({ clientSecret });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start card update." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const result = await requireCustomer();
  if ("error" in result) return result.error;

  let body: { paymentMethodId?: string };
  try {
    body = (await request.json()) as { paymentMethodId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const paymentMethodId = body.paymentMethodId?.trim();
  if (!paymentMethodId) {
    return NextResponse.json({ error: "paymentMethodId is required." }, { status: 400 });
  }

  try {
    await setDefaultPaymentMethod({
      customerId: result.customerId,
      paymentMethodId,
      userId: result.user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update card." },
      { status: 500 },
    );
  }
}
