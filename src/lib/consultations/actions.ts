"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { isEligibleSubscriptionStatus, isQuickbloxConfigured } from "./config";
import type { StartConsultationResult } from "./types";
import {
  buildConsultationEmbedUrl,
  createQuickbloxAppointment,
  ensureQuickbloxClient,
  getCachedClientSession,
  pickReusableAppointmentId,
  resumeStoredAppointment,
} from "./quickblox";
import { readQbClientSession, saveQbClientSession } from "./session-cookie";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  consultationStartedAdminEmail,
  consultationStartedEmail,
  consultationStartedProviderEmail,
} from "@/lib/email/lifecycle-emails";
import { markEmailSent, wasEmailSent } from "@/lib/email/idempotency";
import {
  adminAppUrl,
  adminRecipientEmails,
  appUrl,
  assignedProvidersForPatient,
} from "@/lib/email/recipients";

function friendlyQbError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/blocked|login policy|try in \d+ minutes/i.test(message)) {
    const mins = message.match(/try in (\d+) minutes/i)?.[1];
    if (mins) {
      return `The consultation service is temporarily blocked by QuickBlox. Wait ${mins} minutes and do not click Start during that time — extra attempts keep it locked.`;
    }
    return message.includes("Wait")
      ? message
      : "The consultation service is temporarily blocked by QuickBlox. Wait 30 minutes and do not click Start during that time — extra attempts keep it locked.";
  }
  if (/active appointment/i.test(message)) {
    return "Unable to start this consultation because another visit is still open. Please try again.";
  }
  if (/forbidden/i.test(message.trim())) {
    return "The consultation service is temporarily blocked by QuickBlox. Wait 30 minutes and do not click Start during that time — extra attempts keep it locked.";
  }
  if (message && !/^(unauthorized|forbidden)$/i.test(message.trim())) return message;
  return "QuickBlox could not sign in this consultation. Wait a minute, then try Start once.";
}

async function clientSessionForUser(params: {
  userId: string;
  subscriptionId: string;
  fullName: string;
  dob: string;
  sex: string | null;
}) {
  const cached =
    getCachedClientSession(params.userId, params.subscriptionId) ??
    (await readQbClientSession(params.userId, params.subscriptionId));
  if (cached) {
    await saveQbClientSession(params.userId, params.subscriptionId, cached);
    return cached;
  }

  const session = await ensureQuickbloxClient({
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    fullName: params.fullName,
    dob: params.dob,
    sex: params.sex,
  });
  await saveQbClientSession(params.userId, params.subscriptionId, session);
  return session;
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

  const allRowsResult = await supabaseAdmin
    .from("patient_consultations")
    .select("id, subscription_id, qb_appointment_id, qb_user_id, started_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: true });
  if (allRowsResult.error && !/patient_consultations/i.test(allRowsResult.error.message)) {
    return { ok: false, message: allRowsResult.error.message };
  }
  const allRows = allRowsResult.data ?? [];
  const forThisSub = allRows.find((row) => row.subscription_id === subscription.id);
  const identityRow = allRows.find((row) => row.qb_appointment_id) ?? forThisSub;
  const storedIds = allRows.map((row) => row.qb_appointment_id).filter(Boolean);

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
  const medicineName =
    (subscription as { medicines?: { name?: string } | null }).medicines?.name ?? "treatment";

  try {
    const client = await clientSessionForUser({
      userId: user.id,
      subscriptionId: identityRow?.subscription_id ?? subscription.id,
      fullName,
      dob,
      sex,
    });

    const reusableId = await pickReusableAppointmentId({
      storedIds,
      clientToken: client.token,
      clientId: client.userId,
    });

    if (reusableId) {
      const appointmentId = await resumeStoredAppointment({
        appointmentId: reusableId,
        clientToken: client.token,
        clientId: client.userId,
      });
      const now = new Date().toISOString();
      if (forThisSub?.id) {
        if (
          forThisSub.qb_appointment_id !== appointmentId ||
          forThisSub.qb_user_id !== client.userId
        ) {
          await supabaseAdmin
            .from("patient_consultations")
            .update({
              qb_appointment_id: appointmentId,
              qb_user_id: client.userId,
              updated_at: now,
            })
            .eq("id", forThisSub.id);
        }
      } else {
        const { error: insertError } = await supabaseAdmin.from("patient_consultations").insert({
          user_id: user.id,
          subscription_id: subscription.id,
          qb_user_id: client.userId,
          qb_appointment_id: appointmentId,
        });
        if (insertError && insertError.code !== "23505") {
          return { ok: false, message: insertError.message };
        }
      }

      return {
        ok: true,
        alreadyStarted: true,
        embedUrl: buildConsultationEmbedUrl({
          token: client.token,
          appointmentId,
        }),
      };
    }

    const appointment = await createQuickbloxAppointment({
      clientId: client.userId,
      clientToken: client.token,
      description: `${medicineName} consultation`,
      keepAppointmentId: storedIds[0] ?? null,
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

    void sendConsultationStartedEmail({
      userId: user.id,
      email,
      fullName,
      subscriptionId: subscription.id,
      medicineId: subscription.medicine_id,
      medicineName,
    });

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

async function sendConsultationStartedEmail(params: {
  userId: string;
  email: string;
  fullName: string;
  subscriptionId: string;
  medicineId: string | null;
  medicineName: string;
}) {
  try {
    if (await wasEmailSent("consultation_started", params.subscriptionId)) return;

    const { subject, html } = consultationStartedEmail({
      fullName: params.fullName,
      medicineName: params.medicineName,
      consultationsUrl: `${appUrl()}/consultations`,
    });
    const sent = await sendTransactionalEmail({ to: params.email, subject, html });
    if (sent) await markEmailSent("consultation_started", params.subscriptionId);

    const hubUrl = adminAppUrl();
    const providers = await assignedProvidersForPatient({
      userId: params.userId,
      medicineId: params.medicineId,
    });
    const emailed = new Set<string>([params.email.toLowerCase()]);

    if (providers.length > 0) {
      const providerConsultationsUrl = hubUrl
        ? `${hubUrl}/provider/consultations`
        : "/provider/consultations";
      await Promise.all(
        providers.map(async (provider) => {
          const providerMail = consultationStartedProviderEmail({
            providerName: provider.fullName,
            patientName: params.fullName,
            medicineName: params.medicineName,
            consultationsUrl: providerConsultationsUrl,
          });
          await sendTransactionalEmail({
            to: provider.email,
            subject: providerMail.subject,
            html: providerMail.html,
          });
          emailed.add(provider.email.toLowerCase());
          const { error } = await supabaseAdmin.from("notifications").insert({
            user_id: provider.id,
            type: "consultation_started",
            title: "Patient started a consultation",
            body: `${params.fullName} started a consultation for ${params.medicineName}.`,
            link: "/provider/consultations",
            entity_id: params.subscriptionId,
          });
          if (error) {
            console.error("[consultations] provider notification insert failed:", error);
          }
        }),
      );
    }

    const adminEmails = (await adminRecipientEmails()).filter(
      (to) => !emailed.has(to.toLowerCase()),
    );
    if (adminEmails.length > 0) {
      const adminMail = consultationStartedAdminEmail({
        patientName: params.fullName,
        patientEmail: params.email,
        medicineName: params.medicineName,
        consultationsUrl: `${hubUrl ?? appUrl()}/admin/consultations`,
      });
      await Promise.all(
        adminEmails.map((to) =>
          sendTransactionalEmail({ to, subject: adminMail.subject, html: adminMail.html }),
        ),
      );
    }
  } catch (error) {
    console.error("[consultations] start email failed:", error);
  }
}
