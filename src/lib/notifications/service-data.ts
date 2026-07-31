import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatOrderId } from "@/lib/orders/order-id";
import { patientStatusLabel } from "@/lib/orders/status";

export type PatientNotificationDto = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  status: string;
};

function hrefForStatus(status: string, requestId: string): string {
  if (status === "awaiting_additional_payment") {
    return `/orders/${requestId}/pay`;
  }
  return "/my-meds";
}

export async function fetchPatientNotifications(
  userId: string,
  limit = 20,
): Promise<PatientNotificationDto[]> {
  const { data: requests, error: reqError } = await supabaseAdmin
    .from("medication_requests")
    .select("id, medicine_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (reqError) throw new Error(reqError.message);
  const rows = requests ?? [];
  if (rows.length === 0) return [];

  const requestIds = rows.map((r) => r.id);
  const medicineIds = [
    ...new Set(rows.map((r) => r.medicine_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: meds }, { data: events, error: evError }] = await Promise.all([
    medicineIds.length
      ? supabaseAdmin.from("medicines").select("id, name").in("id", medicineIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabaseAdmin
      .from("medication_request_events")
      .select("id, request_id, status, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (evError) throw new Error(evError.message);

  const medNameById = new Map((meds ?? []).map((m) => [m.id, m.name]));
  const requestById = new Map(rows.map((r) => [r.id, r]));

  return (events ?? []).map((ev) => {
    const request = requestById.get(ev.request_id);
    const medicineName =
      (request?.medicine_id && medNameById.get(request.medicine_id)) || "your medication";
    const orderNumber = formatOrderId(ev.request_id);
    const title = patientStatusLabel(ev.status);
    const body = `${medicineName} · ${orderNumber}`;

    return {
      id: ev.id,
      title,
      body,
      href: hrefForStatus(ev.status, ev.request_id),
      createdAt: ev.created_at,
      status: ev.status,
    };
  });
}
