"use client";

import { useEffect } from "react";

import { debugLog } from "../_lib/debug-log";

export default function OnboardingDebugProbe() {
  useEffect(() => {
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const errorEvent = reason instanceof ErrorEvent ? reason : null;
      const eventTarget =
        reason instanceof Event && reason.target instanceof HTMLElement ? reason.target : null;
      const imgSrc =
        eventTarget instanceof HTMLImageElement
          ? eventTarget.currentSrc || eventTarget.src
          : undefined;

      debugLog({
        runId: "post-fix-3",
        hypothesisId: "E",
        location: "OnboardingDebugProbe.tsx:unhandledrejection",
        message: "Unhandled promise rejection",
        data: {
          pathname: window.location.pathname,
          reasonType: reason === null ? "null" : typeof reason,
          reasonString: String(reason),
          isEvent: typeof Event !== "undefined" && reason instanceof Event,
          eventType:
            typeof Event !== "undefined" && reason instanceof Event ? reason.type : undefined,
          errorMessage: errorEvent?.message,
          errorFilename: errorEvent?.filename,
          targetTag: eventTarget?.tagName,
          targetSrc: imgSrc,
          stack: new Error("rejection-capture").stack,
        },
      });

      // Benign resource error events — Next.js 15 dev overlay shows these as [object Event].
      if (reason instanceof Event && reason.type === "error") {
        event.preventDefault();
      }
    }

    function onWindowError(event: ErrorEvent) {
      debugLog({
        runId: "post-fix-3",
        hypothesisId: "G",
        location: "OnboardingDebugProbe.tsx:window-error",
        message: "Window error event",
        data: {
          pathname: window.location.pathname,
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
        },
      });
    }

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onWindowError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onWindowError);
    };
  }, []);

  return null;
}
