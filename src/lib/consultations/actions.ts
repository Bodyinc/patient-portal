"use server";

import { checkoutCoverageLabel, consultationAnchorId } from "@/lib/checkout/group";
import { userFacingMessage } from "@/lib/user-message";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { appointmentIdToReopen, visitIdToOpen } from "./appointment-id";
import { getQuickbloxConfig, isEligibleSubscriptionStatus, isQuickbloxConfigured } from "./config";
import { loadConsultationEligibility } from "./eligibility";
import { isConsultationFinishedEvent } from "./finished";
import type {
  IntakeAnswerItem,
  PatientConsultationData,
  QuickbloxSdkConfig,
  StartConsultationResult,
} from "./types";
import {
  attachFormSubmissionToAppointment,
  buildConsultationEmbedUrl,
  createQuickbloxAppointment,
  ensureQuickbloxClient,
  fetchAppointmentStatuses,
  getCachedClientSession,
  inspectAppointment,
  listOpenVisitsForClient,
  qbClientEmail,
  qbPasswordForPlan,
  resumeStoredAppointment,
  fetchQuickbloxUserName,
  type QbClientSession,
} from "./quickblox";
import { checkJotformSubmission, fetchJotformSubmissionAnswers, getJotformConfig } from "./jotform";
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

function buildSdkConfig(params: {
  userId: string;
  subscriptionId: string;
  client: QbClientSession;
  appointmentId: string;
  dialogId: string | null;
  caseAssigned: boolean;
  providerId: number | null;
  providerName?: string | null;
  patientName: string;
  medicineName: string;
}): QuickbloxSdkConfig {
  const cfg = getQuickbloxConfig();
  const jotformCfg = getJotformConfig();
  return {
    appId: cfg.appId,
    authKey: cfg.authKey,
    authSecret: cfg.authSecret,
    accountKey: cfg.accountKey,
    userId: params.client.userId,
    email: qbClientEmail(params.userId, params.subscriptionId),
    password: qbPasswordForPlan(params.userId, params.subscriptionId),
    token: params.client.token,
    dialogId: params.dialogId,
    dialogJid: params.dialogId ? `${cfg.appId}_${params.dialogId}@muc.chat.quickblox.com` : null,
    caseAssigned: params.caseAssigned,
    providerId: params.providerId,
    providerName: params.providerName ?? null,
    appointmentId: params.appointmentId,
    patientName: params.patientName,
    medicineName: params.medicineName,
    intakeFormId: jotformCfg.intakeFormId,
    intakeFormBase: jotformCfg.formBase,
  };
}

function buildPatientData(params: {
  fullName: string;
  email: string;
  dob: string | null;
  age: number | null;
  sex: string | null;
  phone: string | null;
  stateCode: string | null;
  heightCm: number | null;
  weightKg: number | null;
  medicineName: string;
  hasFormSubmission: boolean;
  jotformSubmittedAt: string | null;
  jotformSubmissionId: string | null;
  intakeAnswers: IntakeAnswerItem[];
}): PatientConsultationData {
  return {
    fullName: params.fullName,
    email: params.email,
    dob: params.dob,
    age: params.age,
    sex: params.sex,
    phone: params.phone,
    stateCode: params.stateCode,
    heightCm: params.heightCm,
    weightKg: params.weightKg,
    medicineName: params.medicineName,
    planLabel: null,
    imageSrc: null,
    intakeSubmitted: params.hasFormSubmission,
    intakeSubmittedAt: params.jotformSubmittedAt,
    intakeSubmissionId: params.jotformSubmissionId,
    intakeAnswers: params.intakeAnswers,
  };
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

export async function updateConsultationFormSubmittedRecord(params: {
  userId: string;
  subscriptionId: string;
  appointmentId: string;
  submissionId: string;
  submittedAt: string;
}) {
  const { userId, subscriptionId, appointmentId, submissionId, submittedAt } = params;
  const updatePayload = {
    qb_appointment_id: appointmentId,
    form_submitted: true,
    form_submission_id: submissionId,
    form_submitted_at: submittedAt,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("patient_consultations")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("subscription_id", subscriptionId);

  if (error && /form_submitted/i.test(error.message)) {
    await supabaseAdmin
      .from("patient_consultations")
      .update({
        qb_appointment_id: appointmentId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("subscription_id", subscriptionId);
  }
}

async function insertPatientConsultationRecord(params: {
  user_id: string;
  subscription_id: string;
  qb_user_id: number;
  qb_appointment_id: string;
  qb_dialog_id: string | null;
  form_submitted?: boolean;
}) {
  const insertPayload = {
    user_id: params.user_id,
    subscription_id: params.subscription_id,
    qb_user_id: params.qb_user_id,
    qb_appointment_id: params.qb_appointment_id,
    qb_dialog_id: params.qb_dialog_id,
    form_submitted: Boolean(params.form_submitted),
  };

  const res = await supabaseAdmin.from("patient_consultations").insert(insertPayload);
  if (res.error && /form_submitted/i.test(res.error.message)) {
    return supabaseAdmin.from("patient_consultations").insert({
      user_id: params.user_id,
      subscription_id: params.subscription_id,
      qb_user_id: params.qb_user_id,
      qb_appointment_id: params.qb_appointment_id,
      qb_dialog_id: params.qb_dialog_id,
    });
  }
  return res;
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

  subscriptionId = await consultationAnchorId(subscriptionId);

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, session_id, medicine_id, medicines(name)")
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (subError) return { ok: false, message: subError.message };
  if (!subscription) return { ok: false, message: "We could not find that plan." };
  if (!isEligibleSubscriptionStatus(subscription.status)) {
    return { ok: false, message: "Consultations are only available on an active plan." };
  }

  let allRowsResult = await supabaseAdmin
    .from("patient_consultations")
    .select(
      "id, subscription_id, qb_appointment_id, qb_user_id, qb_dialog_id, started_at, ended_at, form_submitted, form_submission_id, form_submitted_at",
    )
    .eq("user_id", user.id)
    .order("started_at", { ascending: true });

  if (
    allRowsResult.error &&
    (/form_submitted/i.test(allRowsResult.error.message) ||
      /ended_at/i.test(allRowsResult.error.message))
  ) {
    allRowsResult = (await supabaseAdmin
      .from("patient_consultations")
      .select("id, subscription_id, qb_appointment_id, qb_user_id, qb_dialog_id, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: true })) as typeof allRowsResult;
  }
  if (allRowsResult.error && !/patient_consultations/i.test(allRowsResult.error.message)) {
    return {
      ok: false,
      message: userFacingMessage(
        allRowsResult.error.message,
        "We couldn't load your consultations. Please refresh and try again.",
      ),
    };
  }
  const allRows = (allRowsResult.data ?? []).map((row) => ({
    ...row,
    ended_at: "ended_at" in row ? ((row as { ended_at?: string | null }).ended_at ?? null) : null,
    form_submitted:
      "form_submitted" in row
        ? Boolean((row as { form_submitted?: boolean | null }).form_submitted)
        : false,
    form_submission_id:
      "form_submission_id" in row
        ? ((row as { form_submission_id?: string | null }).form_submission_id ?? null)
        : null,
    form_submitted_at:
      "form_submitted_at" in row
        ? ((row as { form_submitted_at?: string | null }).form_submitted_at ?? null)
        : null,
  }));
  const forThisSub = allRows.find((row) => row.subscription_id === subscription.id);
  if (!forThisSub) {
    const eligibility = await loadConsultationEligibility(user.id);
    if (!eligibility.needingSubscriptionIds.has(subscription.id)) {
      return { ok: false, message: "This order does not include a consultation." };
    }
  }
  const ownAppointmentId = appointmentIdToReopen(
    allRows.map((row) => ({
      subscriptionId: row.subscription_id,
      appointmentId: row.qb_appointment_id,
    })),
    subscription.id,
  );

  const [{ data: profile }, { data: intake }, medicationRequests] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email, dob, sex, phone, state_code")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("intake_sessions")
      .select("dob, sex, full_name, phone, state_code, height_cm, weight_kg")
      .eq("claimed_by_user_id", user.id)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (async () => {
      const { data: subRow } = await supabaseAdmin
        .from("subscriptions")
        .select("checkout_group_id")
        .eq("id", subscription.id)
        .maybeSingle();
      const subscriptionIds = new Set<string>([subscription.id]);
      if (subRow?.checkout_group_id) {
        const { data: siblings } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("checkout_group_id", subRow.checkout_group_id);
        for (const row of siblings ?? []) subscriptionIds.add(row.id);
      }
      const { data } = await supabaseAdmin
        .from("medication_requests")
        .select("id, provider_id")
        .eq("user_id", user.id)
        .in("subscription_id", [...subscriptionIds]);
      return data ?? [];
    })(),
  ]);

  // A checkout can have several medication requests. Claiming any of them assigns the visit.
  const caseAssigned = (medicationRequests ?? []).some((row) => Boolean(row.provider_id));

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

  let age: number | null = null;
  const birthDate = new Date(dob);
  if (!isNaN(birthDate.getTime())) {
    const diff = Date.now() - birthDate.getTime();
    age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  }

  const fullName = profile?.full_name?.trim() || intake?.full_name?.trim() || "Patient";
  const sex = profile?.sex ?? intake?.sex ?? null;
  const phone = profile?.phone?.trim() || intake?.phone?.trim() || null;
  const stateCode =
    (profile as { state_code?: string | null })?.state_code?.trim() ||
    (intake as { state_code?: string | null })?.state_code?.trim() ||
    null;
  const heightCm = (intake as { height_cm?: number | null })?.height_cm || null;
  const weightKg = (intake as { weight_kg?: number | null })?.weight_kg || null;
  const planMedicineName =
    (subscription as { medicines?: { name?: string } | null }).medicines?.name ?? "treatment";
  const coverage = await checkoutCoverageLabel(
    (subscription as { session_id?: string | null }).session_id,
    planMedicineName,
  );
  const medicineName = coverage.count > 1 ? coverage.label : planMedicineName;

  try {
    const client = await clientSessionForUser({
      userId: user.id,
      subscriptionId: subscription.id,
      fullName,
      dob,
      sex,
    });

    if (ownAppointmentId) {
      const openVisits = await listOpenVisitsForClient({
        clientToken: client.token,
        clientId: client.userId,
      });
      const roomId = visitIdToOpen({ storedId: ownAppointmentId, openAppointments: openVisits });
      const appointmentId = await resumeStoredAppointment({
        appointmentId: roomId,
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
        const { error: insertError } = await insertPatientConsultationRecord({
          user_id: user.id,
          subscription_id: subscription.id,
          qb_user_id: client.userId,
          qb_appointment_id: appointmentId,
          qb_dialog_id: null,
          form_submitted: false,
        });
        if (insertError && insertError.code !== "23505") {
          return { ok: false, message: insertError.message };
        }
      }

      const activeVisit = openVisits.find((v) => v.id === appointmentId);

      // Finished when the provider recorded it, or QuickBlox has date_end.
      // A still-open chat room does not keep the visit open.
      let isFinished = Boolean(forThisSub?.ended_at);
      let liveStatus = null;
      if (!isFinished) {
        const statusMap = await fetchAppointmentStatuses([appointmentId], {
          clientToken: client.token,
        });
        liveStatus = statusMap.get(appointmentId) || null;
        if (liveStatus && !liveStatus.open) {
          isFinished = true;
        } else {
          const inspected = await inspectAppointment(appointmentId, client.token);
          if (inspected?.date_end) {
            isFinished = true;
          }
        }
      }
      if (!isFinished && medicationRequests.length > 0) {
        const requestIds = medicationRequests.map((row) => row.id).filter(Boolean);
        if (requestIds.length > 0) {
          const { data: events } = await supabaseAdmin
            .from("medication_request_events")
            .select("note, status")
            .in("request_id", requestIds);
          if ((events ?? []).some((event) => isConsultationFinishedEvent(event))) {
            isFinished = true;
          }
        }
      }

      if (isFinished && forThisSub?.id && !forThisSub.ended_at) {
        const finishTime = liveStatus?.dateEnd || now;
        await supabaseAdmin
          .from("patient_consultations")
          .update({
            ended_at: finishTime,
            updated_at: now,
          })
          .eq("id", forThisSub.id);
      }

      // Check if form submission exists on this specific QuickBlox appointment / consultation
      let hasFormSubmission = Boolean(
        forThisSub?.form_submitted ||
        forThisSub?.form_submission_id ||
        activeVisit?.hasFormSubmission ||
        activeVisit?.formSubmissionId ||
        liveStatus?.hasFormSubmission ||
        liveStatus?.formSubmissionId,
      );
      let jotformSubmissionId =
        forThisSub?.form_submission_id ||
        activeVisit?.formSubmissionId ||
        liveStatus?.formSubmissionId ||
        null;
      let jotformSubmittedAt: string | null = forThisSub?.form_submitted_at || null;

      if (!hasFormSubmission) {
        // Also check direct inspection of appointment
        const directAppt = await inspectAppointment(appointmentId, client.token);
        if (directAppt?.form_submission_id) {
          hasFormSubmission = true;
          jotformSubmissionId = directAppt.form_submission_id;
        }
      }

      if (!hasFormSubmission) {
        // Collect submission IDs claimed by other consultations so we never steal them
        const excludeSubmissionIds = allRows
          .filter((r) => r.subscription_id !== subscription.id && r.form_submission_id)
          .map((r) => r.form_submission_id as string);

        const jotformCheck = await checkJotformSubmission({
          qbUserId: client.userId,
          email,
          fullName,
          dob,
          phone,
          consultationId: forThisSub?.id,
          subscriptionId: subscription.id,
          appointmentId,
          since: forThisSub?.started_at,
          excludeSubmissionIds,
        });
        if (jotformCheck.submitted && jotformCheck.submissionId) {
          hasFormSubmission = true;
          jotformSubmissionId = jotformCheck.submissionId;
          jotformSubmittedAt = jotformCheck.submittedAt;
          void updateConsultationFormSubmittedRecord({
            userId: user.id,
            subscriptionId: subscription.id,
            appointmentId,
            submissionId: jotformCheck.submissionId,
            submittedAt: jotformCheck.submittedAt || now,
          });
          void attachFormSubmissionToAppointment({
            appointmentId,
            submissionId: jotformCheck.submissionId,
            clientToken: client.token,
          });
        }
      }

      let intakeAnswers: IntakeAnswerItem[] = [];
      if (jotformSubmissionId) {
        intakeAnswers = await fetchJotformSubmissionAnswers(jotformSubmissionId);
      }

      // ONLY consider it a room if form submission actually exists, or appointment is finished
      const isRoom = Boolean(isFinished || hasFormSubmission);

      const dialogId = forThisSub?.qb_dialog_id ?? activeVisit?.dialogId ?? null;
      if (dialogId && forThisSub?.id && forThisSub.qb_dialog_id !== dialogId) {
        void supabaseAdmin
          .from("patient_consultations")
          .update({
            qb_dialog_id: dialogId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", forThisSub.id);
      }

      const providerId = activeVisit?.providerId ?? null;
      let providerName: string | null = null;
      if (providerId) {
        try {
          providerName = await fetchQuickbloxUserName(providerId);
        } catch {
          // ignore
        }
      }

      const patientData = buildPatientData({
        fullName,
        email,
        dob,
        age,
        sex,
        phone,
        stateCode,
        heightCm,
        weightKg,
        medicineName,
        hasFormSubmission,
        jotformSubmittedAt,
        jotformSubmissionId,
        intakeAnswers,
      });

      return {
        ok: true,
        alreadyStarted: isRoom,
        isRoom,
        isFinished,
        appointmentId,
        hasFormSubmission,
        embedUrl: buildConsultationEmbedUrl({
          token: client.token,
          appointmentId,
        }),
        sdkConfig: buildSdkConfig({
          userId: user.id,
          subscriptionId: subscription.id,
          client,
          appointmentId,
          dialogId,
          caseAssigned,
          providerId,
          providerName,
          patientName: fullName,
          medicineName,
        }),
        patientData,
      };
    }

    const appointment = await createQuickbloxAppointment({
      clientId: client.userId,
      clientToken: client.token,
      description:
        coverage.count > 1
          ? `Consultation covering ${coverage.label}`
          : `${medicineName} consultation`,
      reuseOpenVisit: false,
    });

    const newHasFormSubmission = false;
    const newJotformSubmissionId: string | null = null;
    const newJotformSubmittedAt: string | null = null;
    const newIntakeAnswers: IntakeAnswerItem[] = [];

    const patientData = buildPatientData({
      fullName,
      email,
      dob,
      age,
      sex,
      phone,
      stateCode,
      heightCm,
      weightKg,
      medicineName,
      hasFormSubmission: false,
      jotformSubmittedAt: null,
      jotformSubmissionId: null,
      intakeAnswers: [],
    });

    if (forThisSub?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("patient_consultations")
        .update({
          qb_user_id: client.userId,
          qb_appointment_id: appointment._id,
          qb_dialog_id: appointment.dialog_id ?? null,
          form_submitted: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", forThisSub.id);
      if (updateError) return { ok: false, message: updateError.message };

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
        isRoom: false,
        appointmentId: appointment._id,
        hasFormSubmission: false,
        embedUrl: buildConsultationEmbedUrl({
          token: client.token,
          appointmentId: appointment._id,
        }),
        sdkConfig: buildSdkConfig({
          userId: user.id,
          subscriptionId: subscription.id,
          client,
          appointmentId: appointment._id,
          dialogId: appointment.dialog_id ?? null,
          caseAssigned,
          providerId: appointment.provider_id ?? null,
          patientName: fullName,
          medicineName,
        }),
        patientData,
      };
    }

    const { error: insertError } = await insertPatientConsultationRecord({
      user_id: user.id,
      subscription_id: subscription.id,
      qb_user_id: client.userId,
      qb_appointment_id: appointment._id,
      qb_dialog_id: appointment.dialog_id ?? null,
      form_submitted: false,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: raced } = await supabaseAdmin
          .from("patient_consultations")
          .select("qb_appointment_id, qb_dialog_id")
          .eq("subscription_id", subscription.id)
          .maybeSingle();
        if (raced?.qb_appointment_id) {
          return {
            ok: true,
            alreadyStarted: false,
            isRoom: false,
            appointmentId: raced.qb_appointment_id,
            hasFormSubmission: newHasFormSubmission,
            embedUrl: buildConsultationEmbedUrl({
              token: client.token,
              appointmentId: raced.qb_appointment_id,
            }),
            sdkConfig: buildSdkConfig({
              userId: user.id,
              subscriptionId: subscription.id,
              client,
              appointmentId: raced.qb_appointment_id,
              dialogId: (raced as { qb_dialog_id?: string | null })?.qb_dialog_id ?? null,
              caseAssigned,
              providerId: null,
              patientName: fullName,
              medicineName,
            }),
            patientData,
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
      isRoom: false,
      appointmentId: appointment._id,
      hasFormSubmission: newHasFormSubmission,
      embedUrl: buildConsultationEmbedUrl({
        token: client.token,
        appointmentId: appointment._id,
      }),
      sdkConfig: buildSdkConfig({
        userId: user.id,
        subscriptionId: subscription.id,
        client,
        appointmentId: appointment._id,
        dialogId: appointment.dialog_id ?? null,
        caseAssigned,
        providerId: appointment.provider_id ?? null,
        patientName: fullName,
        medicineName,
      }),
      patientData,
    };
  } catch (error) {
    console.error("[consultations] start failed:", error);
    return { ok: false, message: friendlyQbError(error) };
  }
}

export async function recordConsultationRoom(params: {
  subscriptionId: string;
  appointmentId: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!isQuickbloxConfigured()) {
    return { ok: false, message: "Consultations are not available yet." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Please sign in to update consultation." };
  }

  const { subscriptionId, appointmentId } = params;
  if (!subscriptionId || !appointmentId) {
    return { ok: false, message: "Missing required parameters." };
  }

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status")
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (subError || !subscription) {
    return { ok: false, message: "Subscription not found." };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("patient_consultations")
    .update({
      qb_appointment_id: appointmentId,
      updated_at: now,
    })
    .eq("user_id", user.id)
    .eq("subscription_id", subscriptionId);

  if (updateError) {
    console.warn("[consultations] recordConsultationRoom update failed:", updateError);
  }

  return { ok: true };
}

export async function recordConsultationFormSubmission(params: {
  subscriptionId: string;
  appointmentId: string;
  submissionId?: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!isQuickbloxConfigured()) {
    return { ok: false, message: "Consultations are not available yet." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Please sign in to update consultation." };
  }

  const { subscriptionId, appointmentId, submissionId } = params;
  if (!subscriptionId || !appointmentId) {
    return { ok: false, message: "Missing required parameters." };
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("patient_consultations")
    .update({
      qb_appointment_id: appointmentId,
      updated_at: now,
    })
    .eq("user_id", user.id)
    .eq("subscription_id", subscriptionId);

  let finalSubId =
    submissionId && /^\d+$/.test(submissionId.trim()) ? submissionId.trim() : undefined;
  if (!finalSubId) {
    const [{ data: profile }, { data: intake }, { data: consult }, { data: otherConsults }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name, email, dob, sex, phone")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("intake_sessions")
          .select("dob, full_name, phone")
          .eq("claimed_by_user_id", user.id)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("patient_consultations")
          .select("id, qb_user_id, started_at")
          .eq("user_id", user.id)
          .eq("subscription_id", subscriptionId)
          .maybeSingle(),
        supabaseAdmin
          .from("patient_consultations")
          .select("form_submission_id")
          .eq("user_id", user.id)
          .neq("subscription_id", subscriptionId),
      ]);

    const excludeSubmissionIds = (otherConsults ?? [])
      .map((c) => c.form_submission_id)
      .filter((id): id is string => Boolean(id));

    const check = await checkJotformSubmission({
      qbUserId: consult?.qb_user_id ?? null,
      email: profile?.email || user.email,
      fullName: profile?.full_name?.trim() || intake?.full_name?.trim() || null,
      dob: (profile?.dob || intake?.dob)?.slice(0, 10) || null,
      phone: profile?.phone || intake?.phone || null,
      consultationId: consult?.id,
      subscriptionId,
      appointmentId,
      since: consult?.started_at,
      excludeSubmissionIds,
    });
    if (check.submissionId && /^\d+$/.test(check.submissionId.trim())) {
      finalSubId = check.submissionId.trim();
    }
  }

  if (finalSubId) {
    await updateConsultationFormSubmittedRecord({
      userId: user.id,
      subscriptionId,
      appointmentId,
      submissionId: finalSubId,
      submittedAt: now,
    });
    await attachFormSubmissionToAppointment({
      appointmentId,
      submissionId: finalSubId,
    });
  }

  return { ok: true };
}

export async function verifyAndRecordJotformSubmission(params: {
  subscriptionId: string;
  appointmentId: string;
  submissionId?: string;
}): Promise<{
  ok: boolean;
  submitted: boolean;
  submissionId: string | null;
  answers: IntakeAnswerItem[];
  message?: string;
}> {
  if (!isQuickbloxConfigured()) {
    return {
      ok: false,
      submitted: false,
      submissionId: null,
      answers: [],
      message: "Consultations are not configured.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      submitted: false,
      submissionId: null,
      answers: [],
      message: "Please sign in.",
    };
  }

  const { subscriptionId, appointmentId, submissionId } = params;
  if (!subscriptionId || !appointmentId) {
    return {
      ok: false,
      submitted: false,
      submissionId: null,
      answers: [],
      message: "Missing required parameters.",
    };
  }

  const [{ data: profile }, { data: intake }, { data: consult }, { data: otherConsults }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, email, dob, sex, phone")
        .eq("id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("intake_sessions")
        .select("dob, full_name, phone")
        .eq("claimed_by_user_id", user.id)
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("patient_consultations")
        .select("id, qb_user_id, started_at")
        .eq("user_id", user.id)
        .eq("subscription_id", subscriptionId)
        .maybeSingle(),
      supabaseAdmin
        .from("patient_consultations")
        .select("form_submission_id")
        .eq("user_id", user.id)
        .neq("subscription_id", subscriptionId),
    ]);

  let finalSubId = submissionId && /^\d+$/.test(submissionId.trim()) ? submissionId.trim() : null;

  if (!finalSubId) {
    const excludeSubmissionIds = (otherConsults ?? [])
      .map((c) => c.form_submission_id)
      .filter((id): id is string => Boolean(id));

    const check = await checkJotformSubmission({
      qbUserId: consult?.qb_user_id ?? null,
      email: profile?.email || user.email,
      fullName: profile?.full_name?.trim() || intake?.full_name?.trim() || null,
      dob: (profile?.dob || intake?.dob)?.slice(0, 10) || null,
      phone: profile?.phone || intake?.phone || null,
      consultationId: consult?.id,
      subscriptionId,
      appointmentId,
      since: consult?.started_at,
      excludeSubmissionIds,
    });
    if (check.submitted && check.submissionId) {
      finalSubId = check.submissionId;
    }
  }

  if (!finalSubId) {
    return {
      ok: true,
      submitted: false,
      submissionId: null,
      answers: [],
      message: "No submission detected yet. Please make sure you clicked submit on the form.",
    };
  }

  const now = new Date().toISOString();
  await updateConsultationFormSubmittedRecord({
    userId: user.id,
    subscriptionId,
    appointmentId,
    submissionId: finalSubId,
    submittedAt: now,
  });

  await attachFormSubmissionToAppointment({
    appointmentId,
    submissionId: finalSubId,
  });

  const answers = await fetchJotformSubmissionAnswers(finalSubId);

  return {
    ok: true,
    submitted: true,
    submissionId: finalSubId,
    answers,
  };
}

export async function recordConsultationFinished(params: {
  subscriptionId: string;
  appointmentId?: string;
}): Promise<{ ok: boolean }> {
  if (!isQuickbloxConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("patient_consultations")
    .update({
      ended_at: now,
      updated_at: now,
    })
    .eq("user_id", user.id)
    .eq("subscription_id", params.subscriptionId);

  return { ok: true };
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
