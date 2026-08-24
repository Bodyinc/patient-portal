const INTERVAL_MS = 15_000;

type GlobalPoll = typeof globalThis & {
  __bodyincEmailPoll?: ReturnType<typeof setInterval>;
  __bodyincEmailPollRunning?: boolean;
};

export async function register() {
  // This file is compiled for Edge as well as Node. Do not import nodemailer
  // (or anything that pulls it in) here — Edge cannot resolve `stream`.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL === "1") return;

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn(
      "[email] local dispatcher skipped — set CRON_SECRET so order emails can send on localhost",
    );
    return;
  }

  const g = globalThis as GlobalPoll;
  if (g.__bodyincEmailPoll) return;

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `http://localhost:${process.env.PORT || "3000"}`;

  const tick = async () => {
    if (g.__bodyincEmailPollRunning) return;
    g.__bodyincEmailPollRunning = true;
    try {
      await fetch(`${origin}/api/cron/reminders`, {
        headers: { authorization: `Bearer ${secret}` },
        cache: "no-store",
      });
    } catch {
      // First ticks can fail before the dev server is listening.
    } finally {
      g.__bodyincEmailPollRunning = false;
    }
  };

  g.__bodyincEmailPoll = setInterval(() => {
    void tick();
  }, INTERVAL_MS);
  g.__bodyincEmailPoll.unref?.();
  console.info(
    "[email] local dispatcher started — order emails send within 15s (Vercel cron does not run on localhost)",
  );
}
