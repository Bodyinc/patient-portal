"use server";

import { createClient } from "@/lib/supabase/server";
import {
  fetchPatientNotifications,
  type PatientNotificationDto,
} from "@/lib/notifications/service-data";

export type NotificationsResult =
  { ok: true; data: PatientNotificationDto[] } | { ok: false; message: string };

export async function getMyNotifications(): Promise<NotificationsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Not signed in" };
  }

  try {
    const data = await fetchPatientNotifications(user.id);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to load notifications",
    };
  }
}
