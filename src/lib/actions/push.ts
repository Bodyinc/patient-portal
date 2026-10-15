"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isPushConfigured, sendPushToUser } from "@/lib/push/send";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(200),
});

export type PushActionResult = { ok: true } | { ok: false; message: string };

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<PushActionResult> {
  if (!isPushConfigured()) {
    return { ok: false, message: "Push notifications are not configured on this server." };
  }

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid push subscription." };

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(parsed.data.endpoint);
  } catch {
    return { ok: false, message: "Invalid push subscription." };
  }
  if (endpointUrl.protocol !== "https:") {
    return { ok: false, message: "Invalid push subscription." };
  }

  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Not signed in" };

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth_key: parsed.data.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<PushActionResult> {
  const parsed = z.string().url().max(2000).safeParse(endpoint);
  if (!parsed.success) return { ok: false, message: "Invalid push subscription." };

  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Not signed in" };

  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", parsed.data);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function sendTestPush(): Promise<PushActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Not signed in" };
  if (!isPushConfigured()) {
    return { ok: false, message: "Push notifications are not configured on this server." };
  }

  const delivered = await sendPushToUser(userId, {
    title: "BodyInc notifications are on",
    body: "You’ll get alerts here when your care or orders change.",
    url: "/dashboard",
  });
  if (!delivered) {
    return {
      ok: false,
      message: "No device is subscribed yet. Turn notifications on, then try again.",
    };
  }
  return { ok: true };
}
