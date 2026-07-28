type DebugPayload = {
  sessionId?: string;
  runId?: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
};

export function debugLog(payload: DebugPayload) {
  const body = { sessionId: "470da1", ...payload };
  // #region agent log
  fetch("/api/debug-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
  fetch("http://127.0.0.1:7243/ingest/389e4af6-b4a0-4e51-b648-417a32c6ea53", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "470da1" },
    body: JSON.stringify({ ...body, timestamp: Date.now() }),
  }).catch(() => {});
  // #endregion
}
