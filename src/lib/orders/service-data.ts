import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import {
  buildTimeline,
  isConsultationApproved,
  patientStatusLabel,
  type TimelineStep,
} from "./status";

export type PatientOrderLineDto = {
  id: string;
  medicationName: string;
  planName: string | null;
  status: string;
  statusLabel: string;
  isRejected: boolean;
  trackingNumber: string | null;
  requiresConsultation: boolean;
  consultationApproved: boolean;
  pendingPaymentCents: number | null;
  timeline: TimelineStep[];
  prescription: {
    id: string;
    medicineName: string;
    directions: string | null;
    documentUrl: string | null;
    createdAt: string;
  } | null;
};

export type PatientOrderDto = {
  id: string;
  subscriptionId: string | null;
  orderNumber: string;
  medicineName: string;
  planName: string | null;
  kind: string;
  status: string;
  statusLabel: string;
  isRejected: boolean;
  createdAt: string;
  trackingNumber: string | null;
  requiresConsultation: boolean;
  payRequestId: string | null;
  timeline: TimelineStep[];
  prescription: {
    id: string;
    medicineName: string;
    directions: string | null;
    documentUrl: string | null;
    createdAt: string;
  } | null;
  pendingPayment: { id: string; amountCents: number; reason: string | null } | null;
  lines: PatientOrderLineDto[];
};

function toOrderLine(order: PatientOrderDto): PatientOrderLineDto {
  return {
    id: order.id,
    medicationName: order.medicineName,
    planName: order.planName,
    status: order.status,
    statusLabel: order.statusLabel,
    isRejected: order.isRejected,
    trackingNumber: order.trackingNumber,
    requiresConsultation: order.requiresConsultation,
    consultationApproved: isConsultationApproved(order.status, order.requiresConsultation),
    pendingPaymentCents: order.pendingPayment?.amountCents ?? null,
    timeline: order.timeline,
    prescription: order.prescription,
  };
}

/** Initial requests from one checkout share one order number. Later refills stay separate. */
function groupCheckoutOrders(
  orders: PatientOrderDto[],
  membership: Map<string, { checkoutGroupId: string | null; isPrimary: boolean }>,
): PatientOrderDto[] {
  const buckets = new Map<string, PatientOrderDto[]>();
  const solo: PatientOrderDto[] = [];

  for (const order of orders) {
    const member = order.subscriptionId ? membership.get(order.subscriptionId) : undefined;
    const groupId = order.kind === "initial" ? member?.checkoutGroupId : null;
    if (!groupId) {
      solo.push(order);
      continue;
    }
    const list = buckets.get(groupId) ?? [];
    list.push(order);
    buckets.set(groupId, list);
  }

  const grouped: PatientOrderDto[] = [];
  for (const list of buckets.values()) {
    if (list.length < 2) {
      solo.push(list[0]);
      continue;
    }
    const ordered = [...list].sort((a, b) => {
      const aPrimary = a.subscriptionId && membership.get(a.subscriptionId)?.isPrimary ? 0 : 1;
      const bPrimary = b.subscriptionId && membership.get(b.subscriptionId)?.isPrimary ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      return a.createdAt.localeCompare(b.createdAt);
    });
    const primary = ordered[0];
    const names = [...new Set(ordered.map((order) => order.medicineName))];
    const plans = [
      ...new Set(
        ordered.map((order) => order.planName).filter((name): name is string => Boolean(name)),
      ),
    ];
    const statuses = new Set(ordered.map((order) => order.status));
    const tracks = [
      ...new Set(
        ordered
          .map((order) => order.trackingNumber)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const pending = ordered.find((order) => order.pendingPayment);
    grouped.push({
      ...primary,
      orderNumber: formatOrderId(primary.id),
      medicineName: names.join(", "),
      planName: plans.length > 0 ? plans.join(", ") : null,
      statusLabel: statuses.size === 1 ? primary.statusLabel : "Multiple updates",
      trackingNumber: tracks.length === 1 ? tracks[0] : null,
      requiresConsultation: ordered.some((order) => order.requiresConsultation),
      isRejected: ordered.every((order) => order.isRejected),
      pendingPayment: pending?.pendingPayment ?? null,
      payRequestId: pending?.id ?? null,
      lines: ordered.map(toOrderLine),
    });
  }

  return [...grouped, ...solo].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// One query per related table (batched by request ids), never N+1.
export async function fetchPatientOrders(userId: string): Promise<PatientOrderDto[]> {
  const { data: requests, error } = await supabaseAdmin
    .from("medication_requests")
    .select(
      "id, subscription_id, medicine_id, package_id, kind, status, requires_consultation, tracking_number, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const rows = requests ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const subscriptionIds = Array.from(
    new Set(rows.map((r) => r.subscription_id).filter((id): id is string => Boolean(id))),
  );
  const medIds = Array.from(new Set(rows.map((r) => r.medicine_id).filter(Boolean))) as string[];
  const pkgIds = Array.from(new Set(rows.map((r) => r.package_id).filter(Boolean))) as string[];

  const [
    { data: meds },
    { data: pkgs },
    { data: events },
    { data: rxs },
    { data: pays },
    { data: subs },
  ] = await Promise.all([
    medIds.length
      ? supabaseAdmin.from("medicines").select("id, name").in("id", medIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pkgIds.length
      ? supabaseAdmin.from("packages").select("id, name").in("id", pkgIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabaseAdmin
      .from("medication_request_events")
      .select("request_id, status, created_at")
      .in("request_id", ids)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("prescriptions")
      .select("id, request_id, medicine_name, directions, document_url, created_at, status")
      .in("request_id", ids)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("additional_payments")
      .select("id, request_id, amount_cents, reason, status")
      .in("request_id", ids)
      .eq("status", "pending"),
    subscriptionIds.length
      ? supabaseAdmin
          .from("subscriptions")
          .select("id, checkout_group_id, is_checkout_primary")
          .in("id", subscriptionIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            checkout_group_id: string | null;
            is_checkout_primary: boolean;
          }[],
        }),
  ]);

  const medMap = new Map((meds ?? []).map((m) => [m.id, m.name]));
  const pkgMap = new Map((pkgs ?? []).map((p) => [p.id, p.name]));

  const eventsByReq = new Map<string, { status: string; created_at: string }[]>();
  for (const ev of events ?? []) {
    const list = eventsByReq.get(ev.request_id) ?? [];
    list.push({ status: ev.status, created_at: ev.created_at });
    eventsByReq.set(ev.request_id, list);
  }

  const rxByReq = new Map<string, NonNullable<typeof rxs>[number]>();
  for (const rx of rxs ?? []) {
    if (!rxByReq.has(rx.request_id)) rxByReq.set(rx.request_id, rx);
  }

  const payByReq = new Map<string, NonNullable<typeof pays>[number]>();
  for (const p of pays ?? []) {
    if (!payByReq.has(p.request_id)) payByReq.set(p.request_id, p);
  }

  const membership = new Map(
    (subs ?? []).map((sub) => [
      sub.id,
      {
        checkoutGroupId: sub.checkout_group_id,
        isPrimary: sub.is_checkout_primary !== false,
      },
    ]),
  );

  const orders = rows.map((r) => {
    const evs = eventsByReq.get(r.id) ?? [];
    const occurred = new Set(evs.map((e) => e.status));
    const atByStatus = new Map<string, string>();
    for (const e of evs) if (!atByStatus.has(e.status)) atByStatus.set(e.status, e.created_at);

    const rx = rxByReq.get(r.id);
    const pay = payByReq.get(r.id);

    return {
      id: r.id,
      subscriptionId: r.subscription_id,
      orderNumber: formatOrderId(r.id),
      medicineName: (r.medicine_id && medMap.get(r.medicine_id)) || "Medication",
      planName: (r.package_id && pkgMap.get(r.package_id)) || null,
      kind: r.kind,
      status: r.status,
      statusLabel: patientStatusLabel(r.status),
      isRejected: r.status === "rejected" || r.status === "cancelled",
      createdAt: r.created_at,
      trackingNumber: r.tracking_number,
      requiresConsultation: r.requires_consultation,
      payRequestId: null,
      timeline:
        r.status === "rejected" || r.status === "cancelled"
          ? []
          : buildTimeline({
              requiresConsultation: r.requires_consultation,
              currentStatus: r.status,
              occurred,
              atByStatus,
            }),
      prescription: rx
        ? {
            id: rx.id,
            medicineName: rx.medicine_name,
            directions: rx.directions,
            documentUrl: rx.document_url,
            createdAt: rx.created_at,
          }
        : null,
      pendingPayment: pay
        ? { id: pay.id, amountCents: pay.amount_cents, reason: pay.reason }
        : null,
      lines: [],
    };
  });

  return groupCheckoutOrders(orders, membership);
}
