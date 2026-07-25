import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildTimeline, patientStatusLabel, type TimelineStep } from "./status";

export type PatientOrderDto = {
  id: string;
  medicineName: string;
  planName: string | null;
  kind: string;
  status: string;
  statusLabel: string;
  isRejected: boolean;
  createdAt: string;
  trackingNumber: string | null;
  requiresConsultation: boolean;
  timeline: TimelineStep[];
  prescription: {
    id: string;
    medicineName: string;
    directions: string | null;
    documentUrl: string | null;
    createdAt: string;
  } | null;
  pendingPayment: { id: string; amountCents: number; reason: string | null } | null;
};

// One query per related table (batched by request ids), never N+1.
export async function fetchPatientOrders(userId: string): Promise<PatientOrderDto[]> {
  const { data: requests, error } = await supabaseAdmin
    .from("medication_requests")
    .select(
      "id, medicine_id, package_id, kind, status, requires_consultation, tracking_number, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = requests ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const medIds = Array.from(new Set(rows.map((r) => r.medicine_id).filter(Boolean))) as string[];
  const pkgIds = Array.from(new Set(rows.map((r) => r.package_id).filter(Boolean))) as string[];

  const [{ data: meds }, { data: pkgs }, { data: events }, { data: rxs }, { data: pays }] =
    await Promise.all([
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

  return rows.map((r) => {
    const evs = eventsByReq.get(r.id) ?? [];
    const occurred = new Set(evs.map((e) => e.status));
    const atByStatus = new Map<string, string>();
    for (const e of evs) if (!atByStatus.has(e.status)) atByStatus.set(e.status, e.created_at);

    const rx = rxByReq.get(r.id);
    const pay = payByReq.get(r.id);

    return {
      id: r.id,
      medicineName: (r.medicine_id && medMap.get(r.medicine_id)) || "Medication",
      planName: (r.package_id && pkgMap.get(r.package_id)) || null,
      kind: r.kind,
      status: r.status,
      statusLabel: patientStatusLabel(r.status),
      isRejected: r.status === "rejected" || r.status === "cancelled",
      createdAt: r.created_at,
      trackingNumber: r.tracking_number,
      requiresConsultation: r.requires_consultation,
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
    };
  });
}
