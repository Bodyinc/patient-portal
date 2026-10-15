"use client";

import { useEffect } from "react";

/** Registers the BodyInc service worker and drops leftover workers from older tooling. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        const scriptUrl =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          "";
        if (!scriptUrl.endsWith("/sw.js")) {
          void registration.unregister();
        }
      }
    });

    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  return null;
}
