import "server-only";

import webpush from "web-push";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type PushMessage = {
  title: string;
  body: string;
  url: string;
};

function vapidKeys(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:ithelp@bodyinc.com";
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return vapidKeys() !== null;
}

let vapidReady = false;

function ensureVapid(): boolean {
  const keys = vapidKeys();
  if (!keys) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    vapidReady = true;
  }
  return true;
}

/** Deliver a notification to every browser this patient has subscribed. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<boolean> {
  if (!ensureVapid()) return false;

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);
  if (error) {
    console.error("[push] subscription lookup failed:", error.message);
    return false;
  }
  if (!data?.length) return false;

  const payload = JSON.stringify({
    title: message.title.slice(0, 120),
    body: message.body.slice(0, 240),
    url: message.url.startsWith("/") ? message.url : "/dashboard",
  });

  let delivered = 0;
  for (const row of data) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth_key },
        },
        payload,
        { TTL: 60 * 60 * 12 },
      );
      delivered += 1;
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", row.id);
        continue;
      }
      console.error("[push] send failed:", statusCode || err);
    }
  }

  return delivered > 0;
}
