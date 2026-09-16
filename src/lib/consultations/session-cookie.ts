import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { getQuickbloxConfig } from "./config";

const COOKIE = "qb_plan_sess";
const LOCK_COOKIE = "qb_login_lock";
const MAX_AGE_SEC = 90 * 60;
const LOGIN_LOCK_SEC = 30 * 60;

export type QbClientSession = {
  token: string;
  userId: number;
};

function sign(payload: string) {
  return createHmac("sha256", getQuickbloxConfig().userSecret).update(payload).digest("base64url");
}

function signaturesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function readQbClientSession(
  portalUserId: string,
  subscriptionId: string,
): Promise<QbClientSession | null> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    const [payload, signature] = raw.split(".");
    if (!payload || !signature || !signaturesMatch(sign(payload), signature)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      u?: string;
      s?: string;
      t?: string;
      i?: number;
      e?: number;
    };
    if (data.u !== portalUserId || data.s !== subscriptionId) return null;
    if (!data.t || typeof data.i !== "number") return null;
    if (typeof data.e !== "number" || data.e <= Date.now()) return null;
    return { token: data.t, userId: data.i };
  } catch {
    return null;
  }
}

export async function saveQbClientSession(
  portalUserId: string,
  subscriptionId: string,
  session: QbClientSession,
) {
  const payload = Buffer.from(
    JSON.stringify({
      u: portalUserId,
      s: subscriptionId,
      t: session.token,
      i: session.userId,
      e: Date.now() + MAX_AGE_SEC * 1000,
    }),
  ).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  try {
    (await cookies()).set(COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SEC,
    });
  } catch {
    // Server Components cannot set cookies; the client-triggered server action can.
  }
}

function encodeCookie(data: unknown) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeCookie<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !signaturesMatch(sign(payload), signature)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

export async function readLoginLockUntil(key: string): Promise<number> {
  try {
    const data = decodeCookie<{ k?: string; e?: number }>(
      (await cookies()).get(LOCK_COOKIE)?.value,
    );
    if (!data?.e || data.k !== key) return 0;
    return data.e > Date.now() ? data.e : 0;
  } catch {
    return 0;
  }
}

export async function saveLoginLock(key: string) {
  const until = Date.now() + LOGIN_LOCK_SEC * 1000;
  try {
    (await cookies()).set(LOCK_COOKIE, encodeCookie({ k: key, e: until }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LOGIN_LOCK_SEC,
    });
  } catch {
    // ignore
  }
  return until;
}

export async function clearLoginLock(key?: string) {
  try {
    const jar = await cookies();
    if (key) {
      const data = decodeCookie<{ k?: string }>(jar.get(LOCK_COOKIE)?.value);
      if (data?.k && data.k !== key) return;
    }
    jar.delete(LOCK_COOKIE);
  } catch {
    // ignore
  }
}
