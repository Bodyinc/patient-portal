"use client";

import { toast } from "sonner";

import { startConsultation } from "@/lib/consultations/actions";

function writeTab(tab: Window, html: string) {
  try {
    tab.document.open();
    tab.document.write(html);
    tab.document.close();
  } catch {
    // Some browsers lock about:blank immediately; location.replace still works.
  }
}

function openPendingTab(): Window | null {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    toast.error("Allow pop-ups to open your consultation in a new tab.");
    return null;
  }
  tab.opener = null;
  writeTab(
    tab,
    `<!doctype html><title>Opening consultation</title><body style="font-family:DM Sans,sans-serif;padding:32px;color:#152A51">Opening your consultation…</body>`,
  );
  return tab;
}

function sendTabToUrl(tab: Window | null, url: string) {
  if (tab && !tab.closed) {
    tab.location.replace(url);
    tab.focus();
    return;
  }
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
    return;
  }
  toast.error("Allow pop-ups to open your consultation in a new tab.");
}

function closePendingTab(tab: Window | null, message?: string) {
  try {
    tab?.close();
  } catch {
    // ignore
  }
  if (tab && !tab.closed) {
    writeTab(
      tab,
      `<!doctype html><title>Consultation</title><body style="font-family:DM Sans,sans-serif;padding:32px;color:#152A51">${
        message ?? "This consultation could not be opened. You can close this tab."
      }</body>`,
    );
  }
}

/** Start or reopen the stored visit, then open QuickBlox in a new tab. */
export async function openConsultationInNewTab(subscriptionId: string): Promise<boolean> {
  const tab = openPendingTab();
  if (!tab) return false;

  try {
    const result = await startConsultation(subscriptionId);
    if (!result.ok) {
      closePendingTab(tab, result.message);
      toast.error(result.message);
      return false;
    }
    sendTabToUrl(tab, result.embedUrl);
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start this consultation right now.";
    closePendingTab(tab, message);
    toast.error(message);
    return false;
  }
}
