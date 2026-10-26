"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/actions/push";
import { Switch } from "@/components/ui/switch";

const DISMISS_KEY = "bodyinc_push_prompt_dismissed";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function currentSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function enablePush(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!PUBLIC_KEY) {
    return { ok: false, message: "Push notifications are not configured on this server." };
  }
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return { ok: false, message: "This browser does not support push notifications." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      message:
        permission === "denied"
          ? "Notifications are blocked in your browser settings."
          : "Notification permission was not granted.",
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    return { ok: false, message: "Could not create a push subscription." };
  }

  return savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
}

async function disablePush(): Promise<{ ok: true } | { ok: false; message: string }> {
  const subscription = await currentSubscription();
  if (!subscription) return { ok: true };
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return removePushSubscription(endpoint);
}

export function PushSettingsCard() {
  const [supported, setSupported] = useState(false);
  const [denied, setDenied] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const canPush =
      "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(canPush);
    setDenied(canPush && Notification.permission === "denied");
    if (!canPush || Notification.permission !== "granted") {
      setEnabled(false);
      setReady(true);
      return;
    }
    const subscription = await currentSubscription();
    setEnabled(Boolean(subscription));
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onToggle(next: boolean) {
    setBusy(true);
    try {
      const result = next ? await enablePush() : await disablePush();
      if (!result.ok) {
        toast.error(result.message);
        await refresh();
        return;
      }
      setEnabled(next);
      toast.success(
        next ? "Notifications turned on for this device." : "Notifications turned off.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update notifications.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    try {
      const result = await sendTestPush();
      if (!result.ok) toast.error(result.message);
      else toast.success("Test notification sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
      <h2 className="text-[26px] font-medium tracking-[-0.3px] text-[#152A51]">
        Push notifications
      </h2>
      <div className="mt-3 h-px bg-[#E8EEED]" />
      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#152A51]">Alerts on this device</p>
          <p className="mt-1 max-w-xl text-sm text-[#152A51]/70">
            Order updates, upcoming refills, and consultation notices. Account pages stay online
            only — notifications are a short alert, not a stored medical record.
          </p>
          {denied ? (
            <p className="mt-2 text-sm text-[#152A51]/70">
              Notifications are blocked for this site. Allow them in your browser settings, then
              turn this on.
            </p>
          ) : null}
          {!PUBLIC_KEY ? (
            <p className="mt-2 text-sm text-[#152A51]/70">
              Push notifications are not configured on this server yet.
            </p>
          ) : null}
        </div>
        <Switch
          checked={enabled}
          disabled={!ready || busy || !supported || !PUBLIC_KEY || denied}
          onCheckedChange={(checked) => void onToggle(checked)}
          aria-label="Push notifications"
        />
      </div>
      {enabled ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onTest()}
          className="mt-4 text-sm font-medium text-[#152A51] underline-offset-2 hover:underline disabled:opacity-50"
        >
          Send a test notification
        </button>
      ) : null}
    </section>
  );
}

export function PushEnableBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!PUBLIC_KEY) return;
    if (!("Notification" in window) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  async function onEnable() {
    setBusy(true);
    try {
      const result = await enablePush();
      if (!result.ok) {
        toast.error(result.message);
        if (Notification.permission === "denied") setVisible(false);
        return;
      }
      toast.success("Notifications turned on for this device.");
      setVisible(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[#E8EEED] bg-[#F3F6F6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#152A51]">
        Turn on notifications for order updates, refills, and consultations.
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onEnable()}
          className="rounded-full bg-[#152A51] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Enable
        </button>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="text-sm font-medium text-[#152A51]/70"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
