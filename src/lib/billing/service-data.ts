import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { healAndFetchPendingAdditionalPayments } from "@/lib/orders/additional-payment";
import { formatOrderId } from "@/lib/orders/order-id";
import { planTitleFromDuration } from "@/lib/pricing";
import { getPlatformSettings, effectiveShippingCents } from "@/lib/settings/platform-settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { maybeReconcileIncompleteSubscription } from "@/lib/stripe/reconcile";
import { maybeSyncSubscriptionPeriodEnds } from "@/lib/stripe/sync-period-end";
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
  if (status === "refunded") return "Refunded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function matchesPaymentQuery(payment: BillingPaymentDto, query: string): boolean {
  const haystack = [
    payment.orderNumber,
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
type EmbeddedVariant = { id: string; name: string } | null;
type EmbeddedPackage = {
  name: string;
  price: number;
  duration_months: number;
  variant_id: string | null;
  medicine_variants?: EmbeddedVariant;
};

export async function fetchBillingSubscriptions(userId: string): Promise<BillingSubscriptionDto[]> {
  // Embedded select: subscriptions + medicine + package (+ its variant) in ONE round trip.
  const { data: subscriptions, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, medicine_id, package_id, status, current_period_end, cancel_at_period_end, created_at, medicines(name, short_description, image_url), packages(name, price, duration_months, variant_id, medicine_variants(id, name))",
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
    const variantId = pkg?.medicine_variants?.id ?? pkg?.variant_id ?? null;
    const planDollars = Number(pkg?.price ?? 0);

    return {
      id: subscription.id,
      medicineId: subscription.medicine_id,
      packageId: subscription.package_id,
      variantId,
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
      hasPendingAdditionalPayment: false,
    };
  });
}

type PaymentRow = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  raw_event: Json | null;
  plan_id: string | null;
};

const PAYMENT_SELECT =
  "id, amount_cents, status, created_at, stripe_subscription_id, stripe_invoice_id, stripe_payment_intent_id, raw_event, plan_id";

function medicineNameFromAdditionalReason(reason: string | null): string | null {
  if (!reason) return null;
  const match = reason.match(/price difference(?:\s+for(?:\s+changing\s+to)?)?\s+(.+)/i);
  if (!match?.[1]) return null;
  // Variant labels are appended in parentheses, including nested ones like "LYO 10/5mg (2mL)".
  return match[1].replace(/\s*\(.*$/, "").trim() || null;
}

function additionalPaymentDescription(medicineName: string | null, reason: string | null): string {
  const name =
    medicineName?.trim() || medicineNameFromAdditionalReason(reason) || "your medication";
  return `Price difference for ${name}`;
}

type AdditionalPayLookup = {
  stripe_payment_intent_id: string | null;
  reason: string | null;
  to_package_id: string | null;
  request_id: string;
  amount_cents: number;
};

function toPackageInfo(pkg: {
  id: string;
  name: string;
  duration_months: number;
  medicine_variants?: { name: string } | null;
}): { name: string; durationMonths: number; variantName: string | null } {
  return {
    name: pkg.name,
    durationMonths: Number(pkg.duration_months),
    variantName: pkg.medicine_variants?.name ?? null,
  };
}

async function enrichBillingPayments(
  payments: PaymentRow[],
  userId: string,
): Promise<BillingPaymentDto[]> {
  const subscriptionIds = [
    ...new Set(payments.map((payment) => payment.stripe_subscription_id).filter(Boolean)),
  ] as string[];
  const packageIds = [
    ...new Set(payments.map((payment) => payment.plan_id).filter(Boolean)),
  ] as string[];

  const [{ data: subscriptions }, { data: packages }, { data: additionalPays }] = await Promise.all(
    [
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
      supabaseAdmin
        .from("additional_payments")
        .select("stripe_payment_intent_id, reason, to_package_id, request_id, amount_cents")
        .eq("user_id", userId)
        .in("status", ["paid", "pending"]),
    ],
  );

  const addPays = (additionalPays ?? []) as AdditionalPayLookup[];
  const addPayByIntent = new Map(
    addPays
      .filter((row) => row.stripe_payment_intent_id)
      .map((row) => [row.stripe_payment_intent_id as string, row]),
  );
  const extraRequestIds = [...new Set(addPays.map((row) => row.request_id).filter(Boolean))];

  const { data: extraRequests } = extraRequestIds.length
    ? await supabaseAdmin
        .from("medication_requests")
        .select("id, medicine_id, variant_id, package_id, subscription_id")
        .in("id", extraRequestIds)
    : {
        data: [] as Array<{
          id: string;
          medicine_id: string | null;
          variant_id: string | null;
          package_id: string | null;
          subscription_id: string | null;
        }>,
      };

  const extraMedicineIds = [
    ...new Set(
      (extraRequests ?? []).map((row) => row.medicine_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const extraVariantIds = [
    ...new Set(
      (extraRequests ?? []).map((row) => row.variant_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const extraSubIds = [
    ...new Set(
      (extraRequests ?? [])
        .map((row) => row.subscription_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: extraMedicines }, { data: extraVariants }, { data: extraSubs }] =
    await Promise.all([
      extraMedicineIds.length
        ? supabaseAdmin.from("medicines").select("id, name").in("id", extraMedicineIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      extraVariantIds.length
        ? supabaseAdmin.from("medicine_variants").select("id, name").in("id", extraVariantIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      extraSubIds.length
        ? supabaseAdmin
            .from("subscriptions")
            .select("id, package_id, medicines(name)")
            .in("id", extraSubIds)
        : Promise.resolve({ data: [] as Array<{ id: string; package_id: string | null }> }),
    ]);

  const neededPackageIds = [
    ...new Set(
      [
        ...packageIds,
        ...addPays.map((row) => row.to_package_id),
        ...(extraRequests ?? []).map((row) => row.package_id),
        ...(extraSubs ?? []).map((row) => row.package_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const missingPackageIds = neededPackageIds.filter((id) => !packageIds.includes(id));
  const { data: extraPackages } = missingPackageIds.length
    ? await supabaseAdmin
        .from("packages")
        .select("id, name, duration_months, medicine_variants(name)")
        .in("id", missingPackageIds)
    : { data: [] };

  const packageById = new Map(
    [...(packages ?? []), ...(extraPackages ?? [])].map((pkg) => [
      pkg.id,
      toPackageInfo(
        pkg as {
          id: string;
          name: string;
          duration_months: number;
          medicine_variants?: { name: string } | null;
        },
      ),
    ]),
  );
  const subscriptionByStripeId = new Map(
    (subscriptions ?? []).map((sub) => [sub.stripe_subscription_id, sub]),
  );
  const requestById = new Map((extraRequests ?? []).map((row) => [row.id, row]));
  const medicineNameById = new Map((extraMedicines ?? []).map((row) => [row.id, row.name]));
  const variantNameById = new Map((extraVariants ?? []).map((row) => [row.id, row.name]));
  const extraSubById = new Map((extraSubs ?? []).map((row) => [row.id, row]));

  const usedAddPayIntents = new Set<string>();

  function matchAdditionalPay(
    payment: PaymentRow,
    parsedDescription: string,
  ): AdditionalPayLookup | undefined {
    if (payment.stripe_payment_intent_id) {
      const byIntent = addPayByIntent.get(payment.stripe_payment_intent_id);
      if (byIntent) {
        usedAddPayIntents.add(payment.stripe_payment_intent_id);
        return byIntent;
      }
    }
    if (!/price difference/i.test(parsedDescription)) return undefined;
    const fallback = addPays.find((row) => {
      if (row.amount_cents !== payment.amount_cents) return false;
      if (row.stripe_payment_intent_id && usedAddPayIntents.has(row.stripe_payment_intent_id)) {
        return false;
      }
      return true;
    });
    if (fallback?.stripe_payment_intent_id) {
      usedAddPayIntents.add(fallback.stripe_payment_intent_id);
    }
    return fallback;
  }

  return payments.map((payment) => {
    const subscription = payment.stripe_subscription_id
      ? subscriptionByStripeId.get(payment.stripe_subscription_id)
      : undefined;
    const medicine = (subscription as { medicines?: { name: string } | null } | undefined)
      ?.medicines;
    const pkg = payment.plan_id ? packageById.get(payment.plan_id) : undefined;
    const parsedDescription = parsePaymentDescription(
      payment.raw_event,
      pkg ? `${pkg.name} renewal` : "Subscription payment",
    );

    const addPay = matchAdditionalPay(payment, parsedDescription);
    const addRequest = addPay?.request_id ? requestById.get(addPay.request_id) : undefined;
    const addSub = addRequest?.subscription_id
      ? extraSubById.get(addRequest.subscription_id)
      : undefined;
    const addPkgId = addPay?.to_package_id ?? addRequest?.package_id ?? addSub?.package_id ?? null;
    const addPkg = addPkgId ? packageById.get(addPkgId) : undefined;
    const addMedicineName = addRequest?.medicine_id
      ? (medicineNameById.get(addRequest.medicine_id) ?? null)
      : null;
    const addVariantName =
      addPkg?.variantName ??
      (addRequest?.variant_id ? (variantNameById.get(addRequest.variant_id) ?? null) : null);
    const addSubMedicine = (addSub as { medicines?: { name: string } | null } | undefined)
      ?.medicines?.name;

    const medicineName =
      addMedicineName ??
      medicineNameFromAdditionalReason(addPay?.reason ?? parsedDescription) ??
      medicine?.name ??
      addSubMedicine ??
      null;
    const isAdditional = Boolean(addPay) || /price difference/i.test(parsedDescription);
    const description = isAdditional
      ? additionalPaymentDescription(medicineName, addPay?.reason ?? parsedDescription)
      : (medicineName ?? parsedDescription);

    const subscriptionName =
      medicineName ??
      pkg?.name ??
      addPkg?.name ??
      (subscription || addSub ? "Treatment Subscription" : "—");
    const planLabel = addPkg
      ? planTitleFromDuration(addPkg.durationMonths)
      : pkg
        ? planTitleFromDuration(pkg.durationMonths)
        : subscription || addSub
          ? "Subscription"
          : "—";
    const { invoiceUrl, invoicePdfUrl } = parseInvoiceUrls(payment.raw_event);

    return {
      id: payment.id,
      orderNumber: formatOrderId(payment.id),
      date: payment.created_at,
      description,
      subscriptionName,
      variantName: addVariantName ?? pkg?.variantName ?? null,
      planLabel,
      amount: Number(payment.amount_cents) / 100,
      paymentMethod: formatPaymentMethod(payment.raw_event),
      status: normalizeStatus(payment.status),
      stripeInvoiceId: payment.stripe_invoice_id,
      invoiceUrl,
      invoicePdfUrl,
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

  if (!query) {
    const start = (page - 1) * pageSize;
    const {
      data: payments,
      error,
      count,
    } = await supabaseAdmin
      .from("payments")
      .select(PAYMENT_SELECT, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);
    if (error) throw new Error(error.message);

    const items = await enrichBillingPayments((payments ?? []) as PaymentRow[], userId);
    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    return { items, total, page, pageSize, totalPages, query };
  }

  const { data: payments, error } = await supabaseAdmin
    .from("payments")
    .select(PAYMENT_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const enriched = await enrichBillingPayments((payments ?? []) as PaymentRow[], userId);
  const filtered = enriched.filter((payment) => matchesPaymentQuery(payment, query));
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
  const [didReconcile, pendingAdditional, subscriptions, payments] = await Promise.all([
    maybeReconcileIncompleteSubscription(userId),
    healAndFetchPendingAdditionalPayments(userId).catch((err) => {
      console.error("[additional_payments] billing load failed:", err);
      return [];
    }),
    fetchBillingSubscriptions(userId),
    fetchBillingPayments(userId, options),
    maybeSyncSubscriptionPeriodEnds(userId).catch((err) => {
      console.error("[subscriptions] billing period sync failed:", err);
    }),
  ]);

  const resolvedSubscriptions =
    didReconcile === true ? await fetchBillingSubscriptions(userId) : subscriptions;

  const pendingMedicineIds = new Set(
    pendingAdditional.map((p) => p.medicineId).filter((id): id is string => Boolean(id)),
  );
  const pendingSubscriptionIds = new Set(
    pendingAdditional.map((p) => p.subscriptionId).filter((id): id is string => Boolean(id)),
  );

  for (const subscription of resolvedSubscriptions) {
    subscription.hasPendingAdditionalPayment =
      pendingSubscriptionIds.has(subscription.id) ||
      (subscription.medicineId != null && pendingMedicineIds.has(subscription.medicineId));
  }

  return { subscriptions: resolvedSubscriptions, payments };
}

export async function getBillingSubscriptionForCancel(options: {
  userId: string;
  subscriptionId: string;
}): Promise<BillingCancelSubscriptionDto | null> {
  const { userId, subscriptionId } = options;

  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, medicine_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, medicines(name)",
    )
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!subscription) return null;

  const medicineName =
    (subscription as { medicines?: { name: string } | null }).medicines?.name ??
    "Treatment Subscription";

  return {
    id: subscription.id,
    medicineName,
    stripeSubscriptionId: subscription.stripe_subscription_id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end,
    status: subscription.status,
  };
}
