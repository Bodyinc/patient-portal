import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchPatientOrders } from "@/lib/orders/service-data";
import { healAndFetchPendingAdditionalPayments } from "@/lib/orders/additional-payment";
import { maybeReconcileIncompleteSubscription } from "@/lib/stripe/reconcile";
import { maybeSyncSubscriptionPeriodEnds } from "@/lib/stripe/sync-period-end";
import type { Json } from "@/lib/supabase/types";
import type {
  MyMedsCurrentMedicationDto,
  MyMedsMedicationRequestDto,
  MyMedsMedicationRequestsListDto,
  MyMedsPageDataDto,
  MyMedsPastMedicationDto,
} from "./types";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

const SUBSCRIPTION_SELECT =
  "id, medicine_id, package_id, status, current_period_end, created_at, updated_at, medicines(id, name, image_url, important_info), packages(id, name, duration_months, variant_id, medicine_variants(id, name))";

type EmbeddedMedicine = {
  name: string;
  image_url: string | null;
  important_info: Json | null;
} | null;

type EmbeddedPackage = {
  id: string;
  name: string;
  duration_months: number;
  variant_id: string | null;
  medicine_variants?: { id: string; name: string } | null;
} | null;

type SubscriptionRow = {
  id: string;
  medicine_id: string | null;
  package_id: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  medicines?: EmbeddedMedicine;
  packages?: EmbeddedPackage;
};

function formatQuantitySupply(durationMonths: number | null | undefined): string {
  if (!durationMonths || durationMonths <= 0) return "30 Days";
  if (durationMonths === 1) return "30 Days";
  const tabletEstimate = durationMonths * 30;
  return `${tabletEstimate} Tablets / ${durationMonths} Month${durationMonths === 1 ? "" : "s"}`;
}

function parseDosage(importantInfo: Json | null): string {
  if (!importantInfo) return "—";

  if (typeof importantInfo === "object" && !Array.isArray(importantInfo)) {
    const record = importantInfo as Record<string, unknown>;
    const dosage =
      record.dosage ?? record.dose ?? record.strength ?? record.amount ?? record.dosage_strength;
    if (typeof dosage === "string" && dosage.trim()) return dosage;
  }

  if (Array.isArray(importantInfo)) {
    for (const item of importantInfo) {
      if (typeof item === "string") {
        const match = item.match(/\d+(\.\d+)?\s*mg/i);
        if (match) return match[0];
      }
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const label = record.label ?? record.title;
        const value = record.value ?? record.text;
        if (
          typeof label === "string" &&
          /dosage|dose|strength/i.test(label) &&
          typeof value === "string"
        ) {
          return value;
        }
      }
    }
  }

  return "—";
}

function matchesRequestQuery(request: MyMedsMedicationRequestDto, query: string): boolean {
  const haystack = [
    request.orderNumber,
    request.medicationName,
    request.planName ?? "",
    request.statusLabel,
    request.trackingNumber ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function statusLabelForPast(status: string): string {
  if (status === "canceled" || status === "cancelled") return "Canceled";
  if (status === "incomplete_expired") return "Expired";
  if (status === "unpaid") return "Ended";
  if (status === "incomplete") return "Incomplete";
  return "Ended";
}

function mapActiveMedication(subscription: SubscriptionRow): MyMedsCurrentMedicationDto {
  const medicine = subscription.medicines ?? null;
  const pkg = subscription.packages ?? null;

  return {
    subscriptionId: subscription.id,
    medicineId: subscription.medicine_id,
    packageId: subscription.package_id ?? pkg?.id ?? null,
    variantId: pkg?.medicine_variants?.id ?? pkg?.variant_id ?? null,
    medicationName: medicine?.name ?? "Active Medication",
    currentPlan: pkg?.name ?? "Treatment Plan",
    quantitySupply: formatQuantitySupply(pkg?.duration_months),
    dosage: parseDosage(medicine?.important_info ?? null),
    variantName: pkg?.medicine_variants?.name?.trim() || null,
    nextRefillDate: subscription.current_period_end,
    imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
  };
}

function mapPastMedication(subscription: SubscriptionRow): MyMedsPastMedicationDto {
  const medicine = subscription.medicines ?? null;
  const pkg = subscription.packages ?? null;

  return {
    subscriptionId: subscription.id,
    medicineId: subscription.medicine_id,
    packageId: subscription.package_id ?? pkg?.id ?? null,
    variantId: pkg?.medicine_variants?.id ?? pkg?.variant_id ?? null,
    medicationName: medicine?.name ?? "Previous Medication",
    currentPlan: pkg?.name ?? "Treatment Plan",
    variantName: pkg?.medicine_variants?.name?.trim() || null,
    dosage: parseDosage(medicine?.important_info ?? null),
    imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
    endedAt: subscription.current_period_end ?? subscription.updated_at,
    statusLabel: statusLabelForPast(subscription.status),
  };
}

/** Newest active subscriptions — used by Dashboard treatment block. */
export async function fetchActiveMedications(
  userId: string,
  options: { reconcile?: boolean } = {},
): Promise<MyMedsCurrentMedicationDto[]> {
  if (options.reconcile !== false) {
    await maybeReconcileIncompleteSubscription(userId);
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("user_id", userId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!subscriptions?.length) return [];

  return (subscriptions as SubscriptionRow[]).map(mapActiveMedication);
}

export async function fetchMedicationRequests(
  userId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<MyMedsMedicationRequestsListDto> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, options.pageSize ?? 10));
  const query = (options.query ?? "").trim();

  const orders = await fetchPatientOrders(userId);
  const allItems: MyMedsMedicationRequestDto[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    medicationName: o.medicineName,
    planName: o.planName,
    status: o.status,
    statusLabel: o.statusLabel,
    isRejected: o.isRejected,
    requestDate: o.createdAt,
    trackingNumber: o.trackingNumber,
    pendingPaymentCents: o.pendingPayment?.amountCents ?? null,
    prescription: o.prescription
      ? {
          id: o.prescription.id,
          medicineName: o.prescription.medicineName,
          directions: o.prescription.directions,
          documentUrl: o.prescription.documentUrl,
        }
      : null,
    timeline: o.timeline,
  }));

  const filtered = query
    ? allItems.filter((request) => matchesRequestQuery(request, query))
    : allItems;
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

export async function fetchMyMedsPageData(
  userId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<MyMedsPageDataDto> {
  const [, pendingPayments] = await Promise.all([
    maybeReconcileIncompleteSubscription(userId),
    healAndFetchPendingAdditionalPayments(userId).catch((err) => {
      console.error("[additional_payments] My Meds load failed:", err);
      return [];
    }),
    maybeSyncSubscriptionPeriodEnds(userId).catch((err) => {
      console.error("[subscriptions] my-meds period sync failed:", err);
    }),
  ]);

  const [subscriptionsResult, requests] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select(SUBSCRIPTION_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    fetchMedicationRequests(userId, options),
  ]);

  if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message);

  const rows = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const activeStatusSet = new Set(ACTIVE_SUBSCRIPTION_STATUSES);

  const activeMedications = rows
    .filter((row) => activeStatusSet.has(row.status))
    .map(mapActiveMedication);

  const activeMedicineIds = new Set(
    activeMedications.map((med) => med.medicineId).filter((id): id is string => Boolean(id)),
  );

  const seenMedicineIds = new Set<string>(activeMedicineIds);
  const pastMedications: MyMedsPastMedicationDto[] = [];
  // Prefer newest ended treatments first (updated_at), independent of created_at order above.
  const pastRows = [...rows]
    .filter((row) => !activeStatusSet.has(row.status))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  for (const row of pastRows) {
    const medicineId = row.medicine_id;
    if (medicineId && seenMedicineIds.has(medicineId)) continue;
    if (medicineId) seenMedicineIds.add(medicineId);
    pastMedications.push(mapPastMedication(row));
  }

  return { activeMedications, pastMedications, requests, pendingPayments };
}
