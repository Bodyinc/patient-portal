import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type {
  BillingCancelSubscriptionDto,
  BillingPageDataDto,
  BillingPaymentDto,
  BillingPaymentsListDto,
  BillingSubscriptionDto,
} from "./types";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

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
      const first = data[0];
      if (first && typeof first === "object" && !Array.isArray(first)) {
        const description = (first as Record<string, unknown>).description;
        if (typeof description === "string" && description.trim()) {
          return description;
        }
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
    payment.paymentMethod,
    payment.status,
    payment.date,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function fetchBillingSubscriptions(userId: string): Promise<BillingSubscriptionDto[]> {
  const { data: subscriptions, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, medicine_id, package_id, status, current_period_end, cancel_at_period_end, created_at",
    )
    .eq("user_id", userId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!subscriptions?.length) return [];

  const medicineIds = [
    ...new Set(subscriptions.map((sub) => sub.medicine_id).filter(Boolean)),
  ] as string[];
  const packageIds = [
    ...new Set(subscriptions.map((sub) => sub.package_id).filter(Boolean)),
  ] as string[];

  const [{ data: medicines }, { data: packages }] = await Promise.all([
    medicineIds.length
      ? supabaseAdmin
          .from("medicines")
          .select("id, name, short_description, image_url")
          .in("id", medicineIds)
      : Promise.resolve({ data: [] }),
    packageIds.length
      ? supabaseAdmin
          .from("packages")
          .select("id, name, price, duration_months")
          .in("id", packageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine]));
  const packageById = new Map((packages ?? []).map((pkg) => [pkg.id, pkg]));

  return subscriptions.map((subscription) => {
    const medicine = subscription.medicine_id
      ? medicineById.get(subscription.medicine_id)
      : undefined;
    const pkg = subscription.package_id ? packageById.get(subscription.package_id) : undefined;

    return {
      id: subscription.id,
      medicineId: subscription.medicine_id,
      medicineName: medicine?.name ?? "Treatment Subscription",
      description:
        medicine?.short_description ??
        pkg?.name ??
        "Personalized treatment plan with ongoing provider support.",
      imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
      nextBillingDate: subscription.current_period_end,
      upcomingCharge: Number(pkg?.price ?? 0),
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

  const [{ data: subscriptions }, { data: packages }] = await Promise.all([
    subscriptionIds.length
      ? supabaseAdmin
          .from("subscriptions")
          .select("stripe_subscription_id, medicine_id, package_id")
          .in("stripe_subscription_id", subscriptionIds)
      : Promise.resolve({ data: [] }),
    packageIds.length
      ? supabaseAdmin.from("packages").select("id, name").in("id", packageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const medicineIds = [
    ...new Set((subscriptions ?? []).map((sub) => sub.medicine_id).filter(Boolean)),
  ] as string[];

  const { data: medicines } = medicineIds.length
    ? await supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
    : { data: [] };

  const medicineById = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine]));
  const packageById = new Map((packages ?? []).map((pkg) => [pkg.id, pkg.name]));
  const subscriptionByStripeId = new Map(
    (subscriptions ?? []).map((sub) => [sub.stripe_subscription_id, sub]),
  );

  const enriched: BillingPaymentDto[] = (payments ?? []).map((payment) => {
    const subscription = payment.stripe_subscription_id
      ? subscriptionByStripeId.get(payment.stripe_subscription_id)
      : undefined;
    const medicine = subscription?.medicine_id
      ? medicineById.get(subscription.medicine_id)
      : undefined;
    const packageName = payment.plan_id ? packageById.get(payment.plan_id) : undefined;
    const subscriptionName =
      medicine?.name ?? packageName ?? (subscription ? "Treatment Subscription" : "—");
    const fallbackDescription = packageName ? `${packageName} renewal` : "Subscription payment";
    const { invoiceUrl, invoicePdfUrl } = parseInvoiceUrls(payment.raw_event);

    return {
      id: payment.id,
      date: payment.created_at,
      description: parsePaymentDescription(payment.raw_event, fallbackDescription),
      subscriptionName,
      amount: Number(payment.amount_cents) / 100,
      paymentMethod: formatPaymentMethod(payment.raw_event),
      status: normalizeStatus(payment.status),
      stripeInvoiceId: payment.stripe_invoice_id,
      invoiceUrl,
      invoicePdfUrl,
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

export async function fetchBillingPageData(
  userId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<BillingPageDataDto> {
  const [subscriptions, payments] = await Promise.all([
    fetchBillingSubscriptions(userId),
    fetchBillingPayments(userId, options),
  ]);

  return { subscriptions, payments };
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
