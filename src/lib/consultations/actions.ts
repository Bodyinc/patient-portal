"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { isEligibleSubscriptionStatus, isQuickbloxConfigured } from "./config";
import {
  buildConsultationEmbedUrl,
  createQuickbloxAppointment,
  ensureQuickbloxClient,
  loginQuickbloxClient,
} from "./quickblox";
import type { StartConsultationResult } from "./types";

function friendlyQbError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/active appointment/i.test(message)) {
    return "You already have an open visit with your provider. Open that consultation, or finish it before starting another plan.";
  }
  if (/unauthorized/i.test(message)) {
    return "Could not start this plan’s consultation. Open your current visit first, then try this plan again.";
  }
  if (message) return message;
  return "Unable to start your consultation right now. Please try again.";
}

export async function startConsultation(subscriptionId: string): Promise<StartConsultationResult> {
  if (!isQuickbloxConfigured()) {
    return { ok: false, message: "Consultations are not available yet." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Please sign in to start a consultation." };
  }

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, medicine_id, medicines(name)")
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (subError) return { ok: false, message: subError.message };
  if (!subscription) return { ok: false, message: "We could not find that plan." };
  if (!isEligibleSubscriptionStatus(subscription.status)) {
    return { ok: false, message: "Consultations are only available on an active plan." };
  }

  const { data: existing } = await supabaseAdmin
    .from("patient_consultations")
    .select("qb_appointment_id, qb_user_id")
    .eq("subscription_id", subscription.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ data: profile }, { data: intake }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email, dob, sex, phone")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("intake_sessions")
      .select("dob, sex, full_name, phone")
      .eq("claimed_by_user_id", user.id)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const email = (profile?.email || user.email || "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Your account is missing an email address." };

  const dobRaw = profile?.dob ?? intake?.dob ?? null;
  const dob = dobRaw ? dobRaw.slice(0, 10) : null;
  if (!dob) {
    return {
      ok: false,
      message: "Complete your profile date of birth before starting a consultation.",
    };
  }

  const fullName = profile?.full_name?.trim() || intake?.full_name?.trim() || "Patient";
  const sex = profile?.sex ?? intake?.sex ?? null;
  const phone = profile?.phone ?? intake?.phone ?? null;
  const medicineName =
    (subscription as { medicines?: { name?: string } | null }).medicines?.name ?? "treatment";

  try {
    if (existing?.qb_appointment_id) {
      const session = await loginQuickbloxClient(email, user.id);
      return {
        ok: true,
        alreadyStarted: true,
        embedUrl: buildConsultationEmbedUrl({
          token: session.token,
          appointmentId: existing.qb_appointment_id,
        }),
      };
    }

    const client = await ensureQuickbloxClient({
      userId: user.id,
      email,
      fullName,
      dob,
      sex,
      phone,
    });

    const { data: priorVisits } = await supabaseAdmin
      .from("patient_consultations")
      .select("qb_appointment_id")
      .eq("user_id", user.id);

    const appointment = await createQuickbloxAppointment({
      clientId: client.userId,
      clientToken: client.token,
      description: `${medicineName} consultation`,
      previousAppointmentIds: (priorVisits ?? []).map((row) => row.qb_appointment_id),
    });

    const { error: insertError } = await supabaseAdmin.from("patient_consultations").insert({
      user_id: user.id,
      subscription_id: subscription.id,
      qb_user_id: client.userId,
      qb_appointment_id: appointment._id,
      qb_dialog_id: appointment.dialog_id ?? null,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: raced } = await supabaseAdmin
          .from("patient_consultations")
          .select("qb_appointment_id")
          .eq("subscription_id", subscription.id)
          .maybeSingle();
        if (raced?.qb_appointment_id) {
          return {
            ok: true,
            alreadyStarted: true,
            embedUrl: buildConsultationEmbedUrl({
              token: client.token,
              appointmentId: raced.qb_appointment_id,
            }),
          };
        }
      }
      return { ok: false, message: insertError.message };
    }

    return {
      ok: true,
      alreadyStarted: false,
      embedUrl: buildConsultationEmbedUrl({
        token: client.token,
        appointmentId: appointment._id,
      }),
    };
  } catch (error) {
    console.error("[consultations] start failed:", error);
    return { ok: false, message: friendlyQbError(error) };
  }
}
