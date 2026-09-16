import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { getQuickbloxConfig } from "./config";
import { clearLoginLock, readLoginLockUntil, saveLoginLock } from "./session-cookie";

type QbErrorBody = {
  statusCode?: number;
  error?: string;
  message?: string;
};

type QbSession = {
  token: string;
  user_id: number;
};

type QbUser = {
  id: number;
  full_name?: string;
  email?: string;
};

type QbAppointment = {
  _id: string;
  client_id?: number;
  provider_id?: number;
  dialog_id?: string | null;
  description?: string;
  date_end?: string | null;
};

export type QbClientSession = {
  token: string;
  userId: number;
};

const FETCH_TIMEOUT_MS = 12_000;
const SESSION_TTL_MS = 90 * 60 * 1000;
const LOGIN_LOCK_MS = 30 * 60 * 1000;

let providerSessionCache: { token: string; userId: number; expiresAt: number } | null = null;
const clientSessionCache = new Map<string, { token: string; userId: number; expiresAt: number }>();
const loginLockUntil = new Map<string, number>();

function sessionCacheKey(portalUserId: string, subscriptionId: string) {
  return `${portalUserId}:${subscriptionId}`;
}

function lockKey(role: "client" | "provider", email: string) {
  return `${role}:${email.trim().toLowerCase()}`;
}

function lockedUntilMessage(until: number) {
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
  return `The consultation service is temporarily blocked by QuickBlox. Wait ${minutes} minute${
    minutes === 1 ? "" : "s"
  } and do not click Start during that time — extra attempts keep it locked.`;
}

async function assertNotLoginLocked(role: "client" | "provider", email: string) {
  const key = lockKey(role, email);
  const memoryUntil = loginLockUntil.get(key) ?? 0;
  const cookieUntil = await readLoginLockUntil(key);
  const until = Math.max(memoryUntil, cookieUntil);
  if (until > Date.now()) {
    loginLockUntil.set(key, until);
    throw new Error(lockedUntilMessage(until));
  }
}

async function markLoginLocked(role: "client" | "provider", email: string) {
  const key = lockKey(role, email);
  loginLockUntil.set(key, Date.now() + LOGIN_LOCK_MS);
  await saveLoginLock(key);
}

function isLoginLockedError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /blocked|login policy|try in \d+ minutes/i.test(message);
}

function minutesFromLockMessage(message: string) {
  const match = message.match(/try in (\d+) minutes/i);
  return match ? Number(match[1]) : 30;
}

async function rememberProviderLock(error: unknown) {
  if (!isLoginLockedError(error)) return;
  const cfg = getQuickbloxConfig();
  if (!cfg.providerEmail) return;
  const message = error instanceof Error ? error.message : "";
  const minutes = minutesFromLockMessage(message);
  const until = Date.now() + minutes * 60 * 1000;
  loginLockUntil.set(lockKey("provider", cfg.providerEmail), until);
  await saveLoginLock(lockKey("provider", cfg.providerEmail));
  providerSessionCache = null;
}

function isUnauthorized(error: unknown) {
  const status = (error as Error & { status?: number }).status;
  return status === 401;
}

function isActiveAppointmentError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /active appointment/i.test(message);
}

function isUserExistsError(error: unknown) {
  const status = (error as Error & { status?: number }).status;
  const message = error instanceof Error ? error.message : "";
  if (status === 409) return true;
  return status === 422 && /already|exists|taken|duplicate/i.test(message);
}

function qbPasswordForPlan(userId: string, subscriptionId: string) {
  const { userSecret } = getQuickbloxConfig();
  const digest = createHmac("sha256", userSecret)
    .update(`${userId}:${subscriptionId}`)
    .digest("base64url");
  return `Bi.${digest.slice(0, 24)}!`;
}

function qbClientEmail(userId: string, subscriptionId: string) {
  const { userSecret } = getQuickbloxConfig();
  const digest = createHmac("sha256", userSecret)
    .update(`${userId}:${subscriptionId}`)
    .digest("hex")
    .slice(0, 20);
  return `qb.${digest}@patients.bodyinc.com`;
}

function qbGender(sex: string | null | undefined): "male" | "female" {
  return sex === "female" ? "female" : "male";
}

async function qbFetch<T>(
  path: string,
  init: RequestInit & { token?: string; apiKey?: string } = {},
): Promise<T> {
  const { apiUrl } = getQuickbloxConfig();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.apiKey) headers.set("Authorization", `Bearer ${init.apiKey}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("QuickBlox took too long to respond. Please try Start again.");
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    const err = (json ?? {}) as QbErrorBody;
    const raw = err.message || err.error;
    const detail = Array.isArray(raw) ? raw.join(", ") : raw;
    const message = detail || `QuickBlox request failed (${res.status} ${path})`;
    console.error(
      `[consultations] ${init.method ?? "GET"} ${path} ${res.status}:`,
      text.slice(0, 500),
    );
    const error = new Error(message) as Error & { status: number; body: unknown };
    error.status = res.status;
    error.body = json;
    if (/blocked|login policy|try in \d+ minutes/i.test(message)) {
      await rememberProviderLock(error);
    }
    throw error;
  }

  return json as T;
}

async function login(role: "client" | "provider", email: string, password: string) {
  await assertNotLoginLocked(role, email);
  try {
    const result = await qbFetch<{ session: QbSession; data?: QbUser; user?: QbUser }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ role, email, password }),
      },
    );
    const user = result.data ?? result.user;
    if (!result.session?.token || !user?.id) {
      throw new Error("QuickBlox login did not return a session.");
    }
    loginLockUntil.delete(lockKey(role, email));
    await clearLoginLock(lockKey(role, email));
    return { token: result.session.token, user };
  } catch (error) {
    if (isLoginLockedError(error)) {
      await markLoginLocked(role, email);
      throw new Error(lockedUntilMessage(Date.now() + LOGIN_LOCK_MS));
    }
    throw error;
  }
}

function configuredProviderId() {
  return getQuickbloxConfig().providerId;
}

async function getProviderAuth() {
  const cfg = getQuickbloxConfig();
  if (cfg.providerEmail) {
    await assertNotLoginLocked("provider", cfg.providerEmail);
  }

  const now = Date.now();
  if (providerSessionCache && providerSessionCache.token && providerSessionCache.expiresAt > now) {
    return providerSessionCache;
  }

  if (cfg.apiKey && cfg.providerId) {
    return { token: cfg.apiKey, userId: cfg.providerId, expiresAt: now + SESSION_TTL_MS };
  }

  if (cfg.providerEmail && cfg.providerPassword) {
    const { token, user } = await login("provider", cfg.providerEmail, cfg.providerPassword);
    providerSessionCache = {
      token,
      userId: cfg.providerId ?? user.id,
      expiresAt: now + SESSION_TTL_MS,
    };
    return providerSessionCache;
  }

  throw new Error("QuickBlox provider credentials are not configured.");
}

function normalizeFullName(name: string) {
  const trimmed = name.trim() || "Patient";
  return trimmed.length >= 3 ? trimmed.slice(0, 60) : `${trimmed} Patient`.slice(0, 60);
}

function cacheSession(
  portalUserId: string,
  subscriptionId: string,
  token: string,
  userId: number,
): QbClientSession {
  const session = { token, userId };
  clientSessionCache.set(sessionCacheKey(portalUserId, subscriptionId), {
    ...session,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return session;
}

export function getCachedClientSession(
  portalUserId: string,
  subscriptionId: string,
): QbClientSession | null {
  const cached = clientSessionCache.get(sessionCacheKey(portalUserId, subscriptionId));
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return { token: cached.token, userId: cached.userId };
}

async function createClientUser(params: {
  email: string;
  password: string;
  fullName: string;
  dob: string;
  sex: string | null;
}) {
  return qbFetch<{ session: QbSession; user: QbUser }>("/users/client", {
    method: "POST",
    body: JSON.stringify({
      full_name: normalizeFullName(params.fullName),
      email: params.email,
      password: params.password,
      birthdate: params.dob,
      gender: qbGender(params.sex),
    }),
  });
}

function sessionFromCreated(
  created: { session?: QbSession; user?: QbUser },
  portalUserId: string,
  subscriptionId: string,
) {
  if (!created.session?.token || !created.user?.id) {
    throw new Error("QuickBlox did not return a patient session.");
  }
  return cacheSession(portalUserId, subscriptionId, created.session.token, created.user.id);
}

/**
 * One QuickBlox client per paid plan, using a portal-owned email (never the
 * patient's real inbox). Create returns a session so we can skip /auth/login
 * on first start — that login is what QuickBlox locks.
 */
export async function ensureQuickbloxClient(params: {
  userId: string;
  subscriptionId: string;
  fullName: string;
  dob: string;
  sex: string | null;
}): Promise<QbClientSession> {
  const cached = getCachedClientSession(params.userId, params.subscriptionId);
  if (cached) return cached;

  const email = qbClientEmail(params.userId, params.subscriptionId);
  const password = qbPasswordForPlan(params.userId, params.subscriptionId);
  const payload = {
    email,
    password,
    fullName: params.fullName,
    dob: params.dob,
    sex: params.sex,
  };

  try {
    return sessionFromCreated(
      await createClientUser(payload),
      params.userId,
      params.subscriptionId,
    );
  } catch (error) {
    if (isLoginLockedError(error)) throw error;
    if (!isUserExistsError(error)) throw error;
  }

  try {
    const session = await login("client", email, password);
    return cacheSession(params.userId, params.subscriptionId, session.token, session.user.id);
  } catch (error) {
    if (isLoginLockedError(error)) throw error;
    if (!isUnauthorized(error)) throw error;
  }

  const fallback = await createClientUser({
    ...payload,
    email: `qb.${randomBytes(10).toString("hex")}@patients.bodyinc.com`,
    password: `Bi.${randomBytes(12).toString("base64url")}!`,
  });
  return sessionFromCreated(fallback, params.userId, params.subscriptionId);
}

function isAppointmentOpen(appointment: QbAppointment) {
  return appointment.date_end == null || appointment.date_end === "";
}

async function listClientOpenAppointmentIds(clientToken: string, clientId: number) {
  try {
    const listed = await qbFetch<{ items?: QbAppointment[] }>("/appointments/my?limit=20", {
      token: clientToken,
    });
    return (listed.items ?? [])
      .filter(
        (appointment) =>
          Boolean(appointment._id) &&
          isAppointmentOpen(appointment) &&
          (appointment.client_id == null || appointment.client_id === clientId),
      )
      .map((appointment) => appointment._id)
      .slice(0, 5);
  } catch (error) {
    console.warn("[consultations] list my appointments failed:", error);
    return [];
  }
}

async function endAppointment(appointmentId: string, token: string) {
  await qbFetch(`/appointments/${appointmentId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ date_end: new Date().toISOString() }),
  });
}

async function closeThisClientOpenVisits(params: {
  clientId: number;
  clientToken: string;
  extraIds?: string[];
  keepId?: string | null;
}) {
  const ids = new Set(
    (await listClientOpenAppointmentIds(params.clientToken, params.clientId)).concat(
      (params.extraIds ?? []).filter(Boolean),
    ),
  );
  if (params.keepId) ids.delete(params.keepId);

  for (const id of [...ids].slice(0, 5)) {
    try {
      await endAppointment(id, params.clientToken);
    } catch (error) {
      if (isLoginLockedError(error)) throw error;
      console.warn("[consultations] close appointment failed:", id, error);
    }
  }
}

/** Reopen the stored visit. Never create a new QuickBlox appointment for this plan. */
export async function resumeStoredAppointment(params: {
  appointmentId: string;
  clientToken: string;
  clientId?: number;
}) {
  const { appointmentId, clientToken } = params;
  try {
    const current = await qbFetch<QbAppointment>(`/appointments/${appointmentId}`, {
      token: clientToken,
    });
    if (isAppointmentOpen(current)) return appointmentId;
    await qbFetch(`/appointments/${appointmentId}`, {
      method: "PATCH",
      token: clientToken,
      body: JSON.stringify({ date_end: null }),
    }).catch((error) => {
      console.warn("[consultations] reactivate appointment failed:", appointmentId, error);
    });
  } catch (error) {
    console.warn("[consultations] load stored appointment failed:", appointmentId, error);
  }
  return appointmentId;
}

/** Attach the current client to a stored appointment so Open reuses that visit id. */
export async function claimStoredAppointment(params: {
  appointmentId: string;
  clientId: number;
  clientToken: string;
}) {
  try {
    await qbFetch(`/appointments/${params.appointmentId}`, {
      method: "PATCH",
      token: params.clientToken,
      body: JSON.stringify({
        client_id: params.clientId,
        date_end: null,
      }),
    });
  } catch {
    try {
      const provider = await getProviderAuth();
      await qbFetch(`/appointments/${params.appointmentId}`, {
        method: "PATCH",
        token: provider.token,
        body: JSON.stringify({
          client_id: params.clientId,
          date_end: null,
        }),
      });
    } catch (error) {
      console.warn("[consultations] claim appointment failed:", params.appointmentId, error);
    }
  }
  return resumeStoredAppointment({
    appointmentId: params.appointmentId,
    clientToken: params.clientToken,
    clientId: params.clientId,
  });
}

async function postAppointment(params: {
  token: string;
  clientId: number;
  providerId: number;
  description: string;
}) {
  return qbFetch<QbAppointment>("/appointments", {
    method: "POST",
    token: params.token,
    body: JSON.stringify({
      provider_id: params.providerId,
      client_id: params.clientId,
      description: params.description.slice(0, 500),
    }),
  });
}

export async function createQuickbloxAppointment(params: {
  clientId: number;
  clientToken: string;
  description: string;
  previousAppointmentIds?: string[];
  keepAppointmentId?: string | null;
}) {
  const providerId = configuredProviderId() ?? (await getProviderAuth()).userId;

  const tryPost = async (token: string) => {
    try {
      return await postAppointment({
        token,
        clientId: params.clientId,
        providerId,
        description: params.description,
      });
    } catch (error) {
      if (isLoginLockedError(error)) throw error;
      if (!isActiveAppointmentError(error)) throw error;
      await closeThisClientOpenVisits({
        clientId: params.clientId,
        clientToken: params.clientToken,
        extraIds: params.previousAppointmentIds,
        keepId: params.keepAppointmentId,
      });
      return postAppointment({
        token,
        clientId: params.clientId,
        providerId,
        description: params.description,
      });
    }
  };

  try {
    return await tryPost(params.clientToken);
  } catch (error) {
    if (isLoginLockedError(error)) throw error;
    if (!isUnauthorized(error)) throw error;
  }

  const provider = await getProviderAuth();
  try {
    return await tryPost(provider.token);
  } catch (error) {
    if (isLoginLockedError(error)) {
      const cfg = getQuickbloxConfig();
      const until =
        (cfg.providerEmail ? loginLockUntil.get(lockKey("provider", cfg.providerEmail)) : 0) ||
        Date.now() + LOGIN_LOCK_MS;
      throw new Error(lockedUntilMessage(until));
    }
    throw error;
  }
}

export function buildConsultationEmbedUrl(params: { token: string; appointmentId: string }) {
  const { clientAppUrl } = getQuickbloxConfig();
  const url = new URL(`${clientAppUrl}/appointment/${params.appointmentId}`);
  url.searchParams.set("token", params.token);
  return url.toString();
}
