import "server-only";

import type Stripe from "stripe";

import { stripe } from "./server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export type SavedPaymentMethodSummary = {
  id: string;
  brand: string | null;
  last4: string | null;
};

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

/** Customer default card, or the first attached card if no default is set. */
export async function getDefaultPaymentMethod(
  customerId: string,
): Promise<SavedPaymentMethodSummary | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;

  const defaultId = customer.invoice_settings?.default_payment_method;
  if (typeof defaultId === "string" && defaultId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(defaultId);
      if (pm.type === "card") {
        return {
          id: pm.id,
          brand: pm.card?.brand ?? null,
          last4: pm.card?.last4 ?? null,
        };
      }
    } catch {
      // Fall through to list.
    }
  } else if (defaultId && typeof defaultId !== "string" && defaultId.type === "card") {
    return {
      id: defaultId.id,
      brand: defaultId.card?.brand ?? null,
      last4: defaultId.card?.last4 ?? null,
    };
  }

  const listed = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  const first = listed.data[0];
  if (!first) return null;
  return {
    id: first.id,
    brand: first.card?.brand ?? null,
    last4: first.card?.last4 ?? null,
  };
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

export function formatSavedCardLabel(pm: SavedPaymentMethodSummary): string {
  const brand = pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : "Card";
  return pm.last4 ? `${brand} •••• ${pm.last4}` : brand;
}
