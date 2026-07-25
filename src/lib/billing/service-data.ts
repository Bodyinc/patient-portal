import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { planTitleFromDuration } from "@/lib/pricing";
import { getPlatformSettings, effectiveShippingCents } from "@/lib/settings/platform-settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type {
  BillingCancelSubscriptionDto,
  BillingPageDataDto,
  BillingPaymentDto,
  BillingPaymentsListDto,
  BillingSubscriptionDto,
  RefundRequestDto,
} from "./types";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];
const REFUNDABLE_PAYMENT_STATUSES = ["succeeded", "paid"];

function formatPaymentMethod(rawEvent: Json | null): string {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
    return "Card on file";
  }

  const invoice = rawEvent as Record<string, unknown>;
  const charge = invoice.charge;
  if (charge && typeof charge === "object" && !Array.isArray(charge)) {
    const details = (charge as Record<string, unknown>).payment_method_details;
    if (details && typeof details === "object" && !Array.isArray(details)) {
      const card = (details as Record<string, unknown>).card;
      if (card && typeof card === "object" && !Array.isArray(card)) {
        const brand = String((card as Record<string, unknown>).brand ?? "Card");
        const last4 = String((card as Record<string, unknown>).last4 ?? "****");
        return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${last4}`;
      }
    }
  }

  const paymentIntent = invoice.payment_intent;
  if (paymentIntent && typeof paymentIntent === "object" && !Array.isArray(paymentIntent)) {
    const pm = (paymentIntent as Record<string, unknown>).payment_method;
    if (pm && typeof pm === "object" && !Array.isArray(pm)) {
      const card = (pm as Record<string, unknown>).card;
      if (card && typeof card === "object" && !Array.isArray(card)) {
        const brand = String((card as Record<string, unknown>).brand ?? "Card");
        const last4 = String((card as Record<string, unknown>).last4 ?? "****");
        return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${last4}`;
      }
    }
  }

  return "Card on file";
}

function parseInvoiceUrls(rawEvent: Json | null): {
  invoiceUrl: string | null;
  invoicePdfUrl: string | null;
} {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
    return { invoiceUrl: null, invoicePdfUrl: null };
  }

  const invoice = rawEvent as Record<string, unknown>;
  return {
    invoiceUrl: typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null,
    invoicePdfUrl: typeof invoice.invoice_pdf === "string" ? invoice.invoice_pdf : null,
  };
}

function parsePaymentDescription(rawEvent: Json | null, fallback: string): string {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
    return fallback;
  }

  const invoice = rawEvent as Record<string, unknown>;
  const lines = invoice.lines;
  if (lines && typeof lines === "object" && !Array.isArray(lines)) {
    const data = (lines as Record<string, unknown>).data;
    if (Array.isArray(data) && data.length > 0) {
      const asLine = (l: unknown) =>
        l && typeof l === "object" ? (l as Record<string, unknown>) : null;
      const isRecurring = (l: Record<string, unknown>) =>
        Boolean(
          l.subscription || l.plan || (l.price as Record<string, unknown> | undefined)?.recurring,
        );
      // The subscription/plan line — not the one-time fee invoice items (processing /
      // consultation), which sort first in `lines` and otherwise hijack the description.
      const planLine =
        data.map(asLine).find((l) => l && isRecurring(l)) ??
        data
          .map(asLine)
          .find((l) => l && !/\bfee\b|consultation/i.test(String(l.description ?? "")));
      const description = planLine?.description;
      if (typeof description === "string" && description.trim()) {
        return description;
      }
    }
  }

  return fallback;
}

function normalizeStatus(status: string): string {
  if (!status) return "Unknown";
  if (status === "succeeded" || status === "paid") return "Paid";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function matchesPaymentQuery(payment: BillingPaymentDto, query: string): boolean {
  const haystack = [
    payment.description,
    payment.subscriptionName,
    payment.variantName ?? "",
    payment.planLabel,
    payment.paymentMethod,
    payment.status,
    payment.date,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

type EmbeddedMedicine = {
  name: string;
  short_description: string | null;
  image_url: string | null;
};
type EmbeddedVariant = { name: string } | null;
type EmbeddedPackage = {
  name: string;
  price: number;
  duration_months: number;
  medicine_variants?: EmbeddedVariant;
};

export async function fetchBillingSubscriptions(userId: string): Promise<BillingSubscriptionDto[]> {
  // Embedded select: subscriptions + medicine + package (+ its variant) in ONE round trip.
  const { data: subscriptions, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, medicine_id, package_id, status, current_period_end, cancel_at_period_end, created_at, medicines(name, short_description, image_url), packages(name, price, duration_months, medicine_variants(name))",
    )
    .eq("user_id", userId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!subscriptions?.length) return [];

  // Shipping is a separate recurring item on the Stripe subscription; include it so the shown
  // upcoming charge matches what the patient is actually billed (plan + shipping).
  const shippingDollars = effectiveShippingCents(await getPlatformSettings()) / 100;

  return subscriptions.map((subscription) => {
    const medicine = (subscription as { medicines?: EmbeddedMedicine | null }).medicines ?? null;
    const pkg = (subscription as { packages?: EmbeddedPackage | null }).packages ?? null;
    const variantName = pkg?.medicine_variants?.name ?? null;
    const planDollars = Number(pkg?.price ?? 0);

    return {
      id: subscription.id,
      medicineId: subscription.medicine_id,
      medicineName: medicine?.name ?? "Treatment Subscription",
      description:
        medicine?.short_description ??
        pkg?.name ??
        "Personalized treatment plan with ongoing provider support.",
      variantName,
      planLabel: pkg ? planTitleFromDuration(pkg.duration_months) : null,
      imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
      nextBillingDate: subscription.current_period_end,
      upcomingCharge: pkg ? planDollars + shippingDollars : planDollars,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  });
}

export async function fetchBillingPayments(
  userId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<BillingPaymentsListDto> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, options.pageSize ?? 10));
  const query = (options.query ?? "").trim();

  const { data: payments, error } = await supabaseAdmin
    .from("payments")
    .select(
      "id, amount_cents, status, created_at, stripe_subscription_id, stripe_invoice_id, raw_event, plan_id",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const subscriptionIds = [
    ...new Set((payments ?? []).map((payment) => payment.stripe_subscription_id).filter(Boolean)),
  ] as string[];
  const packageIds = [
    ...new Set((payments ?? []).map((payment) => payment.plan_id).filter(Boolean)),
  ] as string[];

  // Two parallel round trips (was three sequential waves): the medicine name rides
  // along on the subscriptions query as an embedded select.
  const [{ data: subscriptions }, { data: packages }] = await Promise.all([
    subscriptionIds.length
      ? supabaseAdmin
          .from("subscriptions")
          .select("stripe_subscription_id, medicine_id, package_id, medicines(name)")
          .in("stripe_subscription_id", subscriptionIds)
      : Promise.resolve({ data: [] }),
    packageIds.length
      ? supabaseAdmin
          .from("packages")
          .select("id, name, duration_months, medicine_variants(name)")
          .in("id", packageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const packageById = new Map(
    (packages ?? []).map((pkg) => [
      pkg.id,
      {
        name: pkg.name as string,
        durationMonths: Number(pkg.duration_months),
        variantName:
          (pkg as { medicine_variants?: { name: string } | null }).medicine_variants?.name ?? null,
      },
    ]),
  );
  const subscriptionByStripeId = new Map(
    (subscriptions ?? []).map((sub) => [sub.stripe_subscription_id, sub]),
  );

  const enriched: BillingPaymentDto[] = (payments ?? []).map((payment) => {
    const subscription = payment.stripe_subscription_id
      ? subscriptionByStripeId.get(payment.stripe_subscription_id)
      : undefined;
    const medicine = (subscription as { medicines?: { name: string } | null } | undefined)
      ?.medicines;
    const pkg = payment.plan_id ? packageById.get(payment.plan_id) : undefined;
    // Description = the product (medicine); fall back to the Stripe line / package name.
    const description =
      medicine?.name ??
      pkg?.name ??
      parsePaymentDescription(
        payment.raw_event,
        pkg ? `${pkg.name} renewal` : "Subscription payment",
      );
    const subscriptionName =
      medicine?.name ?? pkg?.name ?? (subscription ? "Treatment Subscription" : "—");
    const planLabel = pkg
      ? planTitleFromDuration(pkg.durationMonths)
      : subscription
        ? "Subscription"
        : "—";
    const { invoiceUrl, invoicePdfUrl } = parseInvoiceUrls(payment.raw_event);

    return {
      id: payment.id,
      date: payment.created_at,
      description,
      subscriptionName,
      variantName: pkg?.variantName ?? null,
      planLabel,
      amount: Number(payment.amount_cents) / 100,
      paymentMethod: formatPaymentMethod(payment.raw_event),
      status: normalizeStatus(payment.status),
      stripeInvoiceId: payment.stripe_invoice_id,
      invoiceUrl,
      invoicePdfUrl,
      // Filled in by fetchBillingPageData once refund requests resolve (they load in
      // parallel with payments rather than before them).
      refundStatus: null,
      refundable: REFUNDABLE_PAYMENT_STATUSES.includes(payment.status),
    };
  });

  const filtered = query
    ? enriched.filter((payment) => matchesPaymentQuery(payment, query))
    : enriched;
  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    query,
  };
}

export async function fetchRefundRequests(userId: string): Promise<RefundRequestDto[]> {
  const { data, error } = await supabaseAdmin
    .from("refund_requests")
    .select("id, payment_id, amount_cents, status, reason, admin_note, created_at, reviewed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((request) => ({
    id: request.id,
    paymentId: request.payment_id,
    amount: Number(request.amount_cents) / 100,
    status: request.status,
    reason: request.reason,
    adminNote: request.admin_note,
    createdAt: request.created_at,
    reviewedAt: request.reviewed_at,
  }));
}

export async function fetchBillingPageData(
  userId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<BillingPageDataDto> {
  // All three sections in one parallel wave; refund state is merged into the
  // payment rows afterwards instead of gating them behind a sequential fetch.
  const [refundRequests, subscriptions, payments] = await Promise.all([
    fetchRefundRequests(userId),
    fetchBillingSubscriptions(userId),
    fetchBillingPayments(userId, options),
  ]);

  const refundByPayment = new Map<string, string>();
  for (const request of refundRequests) {
    // requests are newest-first, so the first seen per payment is the latest
    if (!refundByPayment.has(request.paymentId)) {
      refundByPayment.set(request.paymentId, request.status);
    }
  }

  for (const payment of payments.items) {
    const refundStatus = refundByPayment.get(payment.id) ?? null;
    payment.refundStatus = refundStatus;
    payment.refundable =
      payment.refundable && (refundStatus === null || refundStatus === "rejected");
  }

  return { subscriptions, payments, refundRequests };
}

export async function getBillingSubscriptionForCancel(options: {
  userId: string;
  subscriptionId: string;
}): Promise<BillingCancelSubscriptionDto | null> {
  const { userId, subscriptionId } = options;

  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, medicine_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end",
    )
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!subscription) return null;

  let medicineName = "Treatment Subscription";
  if (subscription.medicine_id) {
    const { data: medicine } = await supabaseAdmin
      .from("medicines")
      .select("name")
      .eq("id", subscription.medicine_id)
      .maybeSingle();
    if (medicine?.name) medicineName = medicine.name;
  }

  return {
    id: subscription.id,
    medicineName,
    stripeSubscriptionId: subscription.stripe_subscription_id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end,
    status: subscription.status,
  };
}
