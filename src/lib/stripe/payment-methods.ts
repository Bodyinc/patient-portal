import "server-only";

import type Stripe from "stripe";

import { stripe } from "./server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export type SavedPaymentMethodSummary = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

function cardSummaryFromPaymentMethod(pm: {
  id: string;
  card?: Stripe.PaymentMethod.Card | null;
}): SavedPaymentMethodSummary {
  return {
    id: pm.id,
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
  };
}

/** Format expiry as MM/YY when both parts are present. */
export function formatCardExpiry(
  pm: Pick<SavedPaymentMethodSummary, "expMonth" | "expYear">,
): string | null {
  if (!pm.expMonth || !pm.expYear) return null;
  const month = String(pm.expMonth).padStart(2, "0");
  const year = String(pm.expYear).slice(-2);
  return `${month}/${year}`;
}

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
        return cardSummaryFromPaymentMethod(pm);
      }
    } catch {
      // Fall through to list.
    }
  } else if (defaultId && typeof defaultId !== "string" && defaultId.type === "card") {
    return cardSummaryFromPaymentMethod(defaultId);
  }

  const listed = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  const first = listed.data[0];
  if (!first) return null;
  return cardSummaryFromPaymentMethod(first);
}

// Sets the new card as the customer's default and repoints active subscriptions at it,
// so upcoming renewals charge the updated card.
export async function setDefaultPaymentMethod(params: {
  customerId: string;
  paymentMethodId: string;
  userId: string;
}): Promise<SavedPaymentMethodSummary> {
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

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  return cardSummaryFromPaymentMethod(pm);
}

export function formatSavedCardLabel(pm: SavedPaymentMethodSummary): string {
  const brand = pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : "Card";
  return pm.last4 ? `${brand} •••• ${pm.last4}` : brand;
}
