import "server-only";

import { stripe } from "./server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export async function createSetupIntent(customerId: string): Promise<string> {
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });
  if (!setupIntent.client_secret) {
    throw new Error("Stripe returned no client secret for the setup intent.");
  }
  return setupIntent.client_secret;
}

// Sets the new card as the customer's default and repoints active subscriptions at it,
// so upcoming renewals charge the updated card.
export async function setDefaultPaymentMethod(params: {
  customerId: string;
  paymentMethodId: string;
  userId: string;
}): Promise<void> {
  const { customerId, paymentMethodId, userId } = params;

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const { data: subs } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES);

  for (const sub of subs ?? []) {
    if (!sub.stripe_subscription_id) continue;
    try {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        default_payment_method: paymentMethodId,
      });
    } catch {
      // Best effort — the customer-level default still applies to new invoices.
    }
  }
}
