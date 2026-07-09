import "server-only";

import { resolveMedicineImageSrc } from "@/lib/intake/medicine-image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type {
  MyMedsCurrentMedicationDto,
  MyMedsMedicationRequestDto,
  MyMedsMedicationRequestsListDto,
  MyMedsPageDataDto,
} from "./types";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

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
    request.medicationName,
    request.dosage,
    request.supplyDuration,
    request.status,
    request.trackingNumber ?? "",
    request.requestDate,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function fetchCurrentMedication(
  userId: string,
): Promise<MyMedsCurrentMedicationDto | null> {
  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, medicine_id, package_id, current_period_end, created_at")
    .eq("user_id", userId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!subscription) return null;

  const [{ data: medicine }, { data: pkg }] = await Promise.all([
    subscription.medicine_id
      ? supabaseAdmin
          .from("medicines")
          .select("id, name, image_url, important_info")
          .eq("id", subscription.medicine_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    subscription.package_id
      ? supabaseAdmin
          .from("packages")
          .select("id, name, duration_months")
          .eq("id", subscription.package_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    subscriptionId: subscription.id,
    medicineId: subscription.medicine_id,
    medicationName: medicine?.name ?? "Active Medication",
    currentPlan: pkg?.name ?? "Treatment Plan",
    quantitySupply: formatQuantitySupply(pkg?.duration_months),
    dosage: parseDosage(medicine?.important_info ?? null),
    nextRefillDate: subscription.current_period_end,
    imageSrc: resolveMedicineImageSrc(medicine?.image_url ?? null),
  };
}

export async function fetchMedicationRequests(
  _userId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<MyMedsMedicationRequestsListDto> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, options.pageSize ?? 10));
  const query = (options.query ?? "").trim();

  const allItems: MyMedsMedicationRequestDto[] = [];
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
  const [currentMedication, requests] = await Promise.all([
    fetchCurrentMedication(userId),
    fetchMedicationRequests(userId, options),
  ]);

  return { currentMedication, requests };
}
