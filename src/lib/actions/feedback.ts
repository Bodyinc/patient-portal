"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send";
import { adminRecipientEmails } from "@/lib/email/recipients";
import {
  patientFeedbackAdminEmail,
  patientInquiryReplyAdminEmail,
} from "@/lib/email/feedback-email";
import {
  canPatientConfirm,
  canPatientReply,
  isStaleAwaitingConfirmation,
  type FeedbackStatus,
} from "@/lib/feedback-status";
import { getSessionTokenFromCookie } from "@/lib/intake/session";

export type FeedbackActionResult = { ok: true } | { ok: false; code: string; message: string };

export type InquiryReply = {
  id: string;
  author_role: "admin" | "patient";
  body: string;
  created_at: string;
};

export type PatientInquiry = {
  id: string;
  message: string;
  page_path: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  replies: InquiryReply[];
};

const feedbackSchema = z.object({
  message: z.string().trim().min(10, "Please write a bit more detail.").max(2000),
  pagePath: z.string().trim().max(500).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
});

export type FeedbackFormContext = {
  signedIn: boolean;
  collectContact: boolean;
  fullName: string;
  email: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function loadIntakeSessionFromCookie() {
  const token = await getSessionTokenFromCookie();
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("intake_sessions")
    .select("id, full_name, email, claimed_by_user_id")
    .eq("session_token", token)
    .maybeSingle();
  return data;
}

export async function getFeedbackFormContext(): Promise<FeedbackFormContext> {
  const user = await requireUser();
  if (user) {
    return { signedIn: true, collectContact: false, fullName: "", email: "" };
  }

  const session = await loadIntakeSessionFromCookie();
  return {
    signedIn: false,
    collectContact: true,
    fullName: session?.full_name?.trim() ?? "",
    email: session?.email?.trim() ?? "",
  };
}

export async function submitPatientFeedback(
  input: z.infer<typeof feedbackSchema>,
): Promise<FeedbackActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Please check your feedback and try again.",
    };
  }

  const user = await requireUser();
  const session = await loadIntakeSessionFromCookie();

  const emailFromForm = parsed.data.email?.trim() || null;
  const nameFromForm = parsed.data.fullName?.trim() || null;
  let email = emailFromForm;
  let fullName = nameFromForm;

  if (user) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    fullName = fullName || profile?.full_name?.trim() || null;
    email = email || profile?.email?.trim() || user.email || null;
  }

  if (!fullName) fullName = session?.full_name?.trim() || null;
  if (!email) email = session?.email?.trim() || null;

  if (!user && !fullName) {
    return {
      ok: false,
      code: "name_required",
      message: "Enter your name so we know who to follow up with.",
    };
  }

  if (!user && !email) {
    return {
      ok: false,
      code: "email_required",
      message: "Enter your email so we can follow up.",
    };
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  let recentQuery = supabaseAdmin.from("patient_feedback").select("id").gte("created_at", since);
  if (user) {
    recentQuery = recentQuery.eq("user_id", user.id);
  } else if (email) {
    recentQuery = recentQuery.eq("email", email);
  }
  const { data: recent, error: recentError } = await recentQuery.limit(1);
  if (!recentError && recent && recent.length > 0) {
    return {
      ok: false,
      code: "too_soon",
      message: "Please wait a moment before sending another message.",
    };
  }

  const { error } = await supabaseAdmin.from("patient_feedback").insert({
    user_id: user?.id ?? session?.claimed_by_user_id ?? null,
    email,
    full_name: fullName,
    category: "inquiry",
    message: parsed.data.message,
    page_path: parsed.data.pagePath?.trim() || null,
    status: "open",
    intake_session_id: session?.id ?? null,
  });

  if (error) {
    console.error("[feedback] insert failed:", error);
    return {
      ok: false,
      code: "save_error",
      message: "Could not send feedback. Please try again.",
    };
  }

  const recipients = await adminRecipientEmails();
  if (recipients.length === 0) {
    console.warn("[feedback] no admin emails configured — inquiry saved without mail");
  } else {
    const { subject, html } = patientFeedbackAdminEmail({
      message: parsed.data.message,
      pagePath: parsed.data.pagePath?.trim() || null,
      patientName: fullName,
      patientEmail: email,
      intakeSessionId: session?.id ?? null,
    });
    for (const to of recipients) {
      void sendTransactionalEmail({ to, subject, html }).catch((err) => {
        console.error(`[feedback] notify email failed for ${to}:`, err);
      });
    }
  }

  revalidatePath("/inquiries");
  return { ok: true };
}

async function autoResolveStaleInquiries() {
  const { data: rows } = await supabaseAdmin
    .from("patient_feedback")
    .select("id, updated_at")
    .eq("status", "awaiting_confirmation")
    .limit(300);
  const stale = (rows ?? []).filter((row) => isStaleAwaitingConfirmation(row.updated_at));
  if (stale.length === 0) return;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("patient_feedback")
    .update({ status: "resolved", updated_at: now, resolved_at: now })
    .in(
      "id",
      stale.map((row) => row.id),
    );
}

export async function listMyInquiries(): Promise<PatientInquiry[]> {
  const user = await requireUser();
  if (!user) return [];
  await autoResolveStaleInquiries();

  const [{ data: claimed }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("intake_sessions").select("id").eq("claimed_by_user_id", user.id),
    supabaseAdmin.from("profiles").select("email").eq("id", user.id).maybeSingle(),
  ]);
  const sessionIds = (claimed ?? []).map((row) => row.id);
  const email = profile?.email?.trim() || user.email?.trim() || "";

  const filters = [`user_id.eq.${user.id}`];
  if (sessionIds.length > 0) filters.push(`intake_session_id.in.(${sessionIds.join(",")})`);
  if (email && !email.includes(",")) filters.push(`email.eq.${email}`);

  const { data: rows, error } = await supabaseAdmin
    .from("patient_feedback")
    .select("id, message, page_path, status, created_at, updated_at, resolved_at")
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[feedback] list failed:", error);
    throw new Error("Could not load your inquiries.");
  }

  const ids = (rows ?? []).map((row) => row.id);
  const repliesByFeedback = new Map<string, InquiryReply[]>();
  if (ids.length > 0) {
    const { data: replies, error: replyErr } = await supabaseAdmin
      .from("patient_feedback_replies")
      .select("id, feedback_id, author_role, body, created_at")
      .in("feedback_id", ids)
      .order("created_at", { ascending: true });
    if (replyErr) {
      console.error("[feedback] replies list failed:", replyErr);
      throw new Error("Could not load your inquiries.");
    }
    for (const reply of replies ?? []) {
      const list = repliesByFeedback.get(reply.feedback_id) ?? [];
      list.push({
        id: reply.id,
        author_role: reply.author_role as InquiryReply["author_role"],
        body: reply.body,
        created_at: reply.created_at,
      });
      repliesByFeedback.set(reply.feedback_id, list);
    }
  }

  return (rows ?? []).map((row) => ({
    id: row.id,
    message: row.message,
    page_path: row.page_path,
    status: row.status as FeedbackStatus,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    resolved_at: row.resolved_at,
    replies: repliesByFeedback.get(row.id) ?? [],
  }));
}

const replySchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(10, "Please write a bit more detail.").max(2000),
});

export async function replyToInquiry(
  input: z.infer<typeof replySchema>,
): Promise<FeedbackActionResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Please check your reply and try again.",
    };
  }

  const user = await requireUser();
  if (!user) {
    return { ok: false, code: "unauthorized", message: "Sign in to reply." };
  }

  const { data: row, error: loadErr } = await supabaseAdmin
    .from("patient_feedback")
    .select("id, user_id, email, full_name, message, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (loadErr) {
    console.error("[feedback] reply load failed:", loadErr);
    return {
      ok: false,
      code: "save_error",
      message: "Could not send your reply. Please try again.",
    };
  }
  if (!row || row.user_id !== user.id) {
    return { ok: false, code: "not_found", message: "Inquiry not found." };
  }
  if (!canPatientReply(row.status)) {
    return {
      ok: false,
      code: "closed",
      message: "This inquiry is closed. Send a new one if you still need help.",
    };
  }

  const now = new Date().toISOString();
  const { error: replyErr } = await supabaseAdmin.from("patient_feedback_replies").insert({
    feedback_id: row.id,
    author_role: "patient",
    author_user_id: user.id,
    body: parsed.data.body,
  });
  if (replyErr) {
    console.error("[feedback] reply insert failed:", replyErr);
    return {
      ok: false,
      code: "save_error",
      message: "Could not send your reply. Please try again.",
    };
  }

  const { error: updErr } = await supabaseAdmin
    .from("patient_feedback")
    .update({
      status: "open",
      updated_at: now,
      resolved_at: null,
    })
    .eq("id", row.id);
  if (updErr) {
    console.error("[feedback] reply status failed:", updErr);
    return {
      ok: false,
      code: "save_error",
      message: "Could not send your reply. Please try again.",
    };
  }

  const recipients = await adminRecipientEmails();
  if (recipients.length > 0) {
    const { subject, html } = patientInquiryReplyAdminEmail({
      message: row.message,
      reply: parsed.data.body,
      patientName: row.full_name,
      patientEmail: row.email,
    });
    for (const to of recipients) {
      void sendTransactionalEmail({ to, subject, html }).catch((err) => {
        console.error(`[feedback] reply notify email failed for ${to}:`, err);
      });
    }
  }

  revalidatePath("/inquiries");
  return { ok: true };
}

export async function confirmInquirySolved(id: string): Promise<FeedbackActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input", message: "Inquiry not found." };
  }

  const user = await requireUser();
  if (!user) {
    return { ok: false, code: "unauthorized", message: "Sign in to confirm." };
  }

  const { data: row, error: loadErr } = await supabaseAdmin
    .from("patient_feedback")
    .select("id, user_id, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (loadErr || !row || row.user_id !== user.id) {
    return { ok: false, code: "not_found", message: "Inquiry not found." };
  }
  if (!canPatientConfirm(row.status)) {
    return {
      ok: false,
      code: "not_waiting",
      message: "This inquiry is not waiting for confirmation.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("patient_feedback")
    .update({ status: "resolved", updated_at: now, resolved_at: now })
    .eq("id", row.id);
  if (error) {
    console.error("[feedback] confirm failed:", error);
    return {
      ok: false,
      code: "save_error",
      message: "Could not update this inquiry. Please try again.",
    };
  }

  revalidatePath("/inquiries");
  return { ok: true };
}
