"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send";
import { adminRecipientEmails } from "@/lib/email/recipients";
import { patientFeedbackAdminEmail } from "@/lib/email/feedback-email";

export type FeedbackActionResult = { ok: true } | { ok: false; code: string; message: string };

const feedbackSchema = z.object({
  message: z.string().trim().min(10, "Please write a bit more detail.").max(2000),
  pagePath: z.string().trim().max(500).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
});

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const emailFromForm = parsed.data.email?.trim() || null;
  let email = emailFromForm;
  let fullName: string | null = null;

  if (user) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    fullName = profile?.full_name?.trim() || null;
    email = email || profile?.email?.trim() || user.email || null;
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
    user_id: user?.id ?? null,
    email,
    full_name: fullName,
    category: "inquiry",
    message: parsed.data.message,
    page_path: parsed.data.pagePath?.trim() || null,
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
    });
    for (const to of recipients) {
      void sendTransactionalEmail({ to, subject, html }).catch((err) => {
        console.error(`[feedback] notify email failed for ${to}:`, err);
      });
    }
  }

  return { ok: true };
}
