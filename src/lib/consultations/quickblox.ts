import "server-only";

import { createHmac } from "node:crypto";

import { getQuickbloxConfig } from "./config";
import { clearLoginLock, readLoginLockUntil, saveLoginLock } from "./session-cookie";

export type QbClientSession = {
  token: string;
  userId: number;
};

export type AppointmentCloseState = {
  open: boolean;
  dateEnd: string | null;
  formSubmissionId?: string | null;
  hasFormSubmission?: boolean;
};

export type QbAppointment = {
  _id: string;
  client_id?: number;
  provider_id?: number;
  dialog_id?: string | null;
  description?: string;
  date_end?: string | null;
  form_submission_id?: string | null;
  created_at?: number;
};

const SESSION_TTL_MS = 90 * 60 * 1000;
const LOGIN_LOCK_MS = 30 * 60 * 1000;

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

function cacheSession(
  portalUserId: string,
  subscriptionId: string,
  token: string,
  userId: number,
): QbClientSession {
  clientSessionCache.set(sessionCacheKey(portalUserId, subscriptionId), {
    token,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return { token, userId };
}

export function qbPasswordForPlan(userId: string, subscriptionId: string) {
  const { userSecret } = getQuickbloxConfig();
  const digest = createHmac("sha256", userSecret)
    .update(`${userId}:${subscriptionId}`)
    .digest("base64url");
  return `Bi.${digest.slice(0, 24)}!`;
}

export function qbClientEmail(userId: string, subscriptionId: string) {
  const { userSecret } = getQuickbloxConfig();
  const digest = createHmac("sha256", userSecret)
    .update(`${userId}:${subscriptionId}`)
    .digest("hex")
    .slice(0, 20);
  return `qb.${digest}@patients.bodyinc.com`;
}

export function qbClientLogin(userId: string, subscriptionId: string) {
  const { userSecret } = getQuickbloxConfig();
  const digest = createHmac("sha256", userSecret)
    .update(`${userId}:${subscriptionId}`)
    .digest("hex")
    .slice(0, 16);
  return `pt_${digest}`;
}

/**
 * Creates an application or user session via direct QuickBlox REST API (POST /session.json).
 * This completely avoids importing the client-side QuickBlox XMPP/WebRTC SDK on the server.
 */
async function createQbRestSession(userCreds?: { email?: string; password?: string }): Promise<{
  token: string;
  userId?: number;
}> {
  const cfg = getQuickbloxConfig();
  const nonce = Math.floor(Math.random() * 1000000000);
  const timestamp = Math.floor(Date.now() / 1000);

  const message: Record<string, unknown> = {
    application_id: cfg.appId,
    auth_key: cfg.authKey,
    nonce,
    timestamp,
  };

  if (userCreds?.email && userCreds?.password) {
    message.user = { email: userCreds.email, password: userCreds.password };
  }

  const sortedParams = Object.keys(message)
    .map((key) => {
      const val = message[key];
      if (typeof val === "object" && val !== null) {
        const sub = val as Record<string, string>;
        return Object.keys(sub)
          .map((subKey) => `${key}[${subKey}]=${sub[subKey]}`)
          .sort()
          .join("&");
      }
      return `${key}=${val}`;
    })
    .sort()
    .join("&");

  const signature = createHmac("sha1", cfg.authSecret).update(sortedParams).digest("hex");
  message.signature = signature;

  const res = await fetch(`${cfg.apiUrl}/session.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "QuickBlox-REST-API-Version": "0.1.1",
    },
    body: JSON.stringify(message),
    cache: "no-store",
  });

  const json = (await res.json()) as {
    session?: { token: string; user_id?: number };
    errors?: unknown;
  };

  if (!res.ok || !json?.session?.token) {
    const errorMsg = Array.isArray(json?.errors)
      ? json.errors.join(", ")
      : typeof json?.errors === "object"
        ? JSON.stringify(json.errors)
        : res.statusText;
    throw new Error(`QuickBlox session failed: ${errorMsg}`);
  }

  return {
    token: json.session.token,
    userId: json.session.user_id ? Number(json.session.user_id) : undefined,
  };
}

/**
 * Registers a new patient user in QuickBlox via REST API (POST /users.json).
 */
async function createQbRestUser(params: {
  appToken: string;
  login: string;
  email: string;
  password: string;
  fullName: string;
}): Promise<number | null> {
  const cfg = getQuickbloxConfig();
  try {
    const res = await fetch(`${cfg.apiUrl}/users.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "QB-Token": params.appToken,
      },
      body: JSON.stringify({
        user: {
          login: params.login,
          email: params.email,
          password: params.password,
          full_name: params.fullName || "Patient",
          tag_list: "patient, client",
        },
      }),
      cache: "no-store",
    });

    const json = (await res.json()) as { user?: { id: number }; errors?: unknown };
    if (res.status === 201 && json?.user?.id) {
      return json.user.id;
    }
  } catch (err) {
    console.warn("[consultations] createQbRestUser notice:", err);
  }
  return null;
}

/**
 * Creates a consultation chat dialog via direct QuickBlox REST API (POST /chat/Dialog.json).
 */
async function createQbRestDialog(params: {
  clientToken: string;
  name: string;
  providerId: number;
}): Promise<{ _id: string; xmpp_room_jid?: string }> {
  const cfg = getQuickbloxConfig();
  const res = await fetch(`${cfg.apiUrl}/chat/Dialog.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "QB-Token": params.clientToken,
    },
    body: JSON.stringify({
      type: 2, // Group chat room
      name: params.name || "Medical Consultation",
      occupants_ids: [params.providerId],
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as { _id?: string; xmpp_room_jid?: string; errors?: unknown };
  if (!res.ok || !json?._id) {
    const errorMsg = Array.isArray(json?.errors)
      ? json.errors.join(", ")
      : typeof json?.errors === "object"
        ? JSON.stringify(json.errors)
        : res.statusText;
    throw new Error(`QuickBlox dialog creation failed: ${errorMsg}`);
  }

  return { _id: json._id, xmpp_room_jid: json.xmpp_room_jid };
}

export function getCachedClientSession(
  portalUserId: string,
  subscriptionId: string,
): QbClientSession | null {
  const cached = clientSessionCache.get(sessionCacheKey(portalUserId, subscriptionId));
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return { token: cached.token, userId: cached.userId };
}

/**
 * Ensures a QuickBlox client exists in the official QuickBlox cloud for this patient.
 * Signs in if the account exists, or creates the user via an application session if not.
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
  const login = qbClientLogin(params.userId, params.subscriptionId);
  const password = qbPasswordForPlan(params.userId, params.subscriptionId);

  await assertNotLoginLocked("client", email);

  // 1. First attempt: Direct user login
  try {
    const userSession = await createQbRestSession({ email, password });
    if (userSession.token && userSession.userId) {
      loginLockUntil.delete(lockKey("client", email));
      await clearLoginLock(lockKey("client", email));
      return cacheSession(
        params.userId,
        params.subscriptionId,
        userSession.token,
        userSession.userId,
      );
    }
  } catch {
    // User does not exist yet or direct login failed; proceed to register user
  }

  // 2. User account does not exist in QuickBlox yet: create an app session first
  const appSession = await createQbRestSession();

  // 3. Register the patient user in QuickBlox
  await createQbRestUser({
    appToken: appSession.token,
    login,
    email,
    password,
    fullName: params.fullName || "Patient",
  });

  // 4. Log in as the patient user
  const finalSession = await createQbRestSession({ email, password });
  if (!finalSession.token || !finalSession.userId) {
    throw new Error("QuickBlox user session creation failed.");
  }

  loginLockUntil.delete(lockKey("client", email));
  await clearLoginLock(lockKey("client", email));

  return cacheSession(
    params.userId,
    params.subscriptionId,
    finalSession.token,
    finalSession.userId,
  );
}

/**
 * Creates a consultation chat dialog in QuickBlox using the patient token and links provider.
 */
export async function createQuickbloxAppointment(params: {
  clientId: number;
  clientToken: string;
  description: string;
  reuseOpenVisit?: boolean;
}): Promise<QbAppointment> {
  const cfg = getQuickbloxConfig();
  const providerId = cfg.providerId || 142814409;

  const dialog = await createQbRestDialog({
    clientToken: params.clientToken,
    name: params.description || "Medical Consultation",
    providerId,
  });

  return {
    _id: dialog._id,
    client_id: params.clientId,
    provider_id: providerId,
    dialog_id: dialog._id,
    description: params.description,
    created_at: Date.now(),
  };
}

/**
 * Returns appointment status map for given IDs.
 */
export async function fetchAppointmentStatuses(
  ids: string[],
  _options?: { clientToken?: string; clientTokens?: string[] },
): Promise<Map<string, AppointmentCloseState>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, AppointmentCloseState>();
  for (const id of unique) {
    map.set(id, {
      open: true,
      dateEnd: null,
      hasFormSubmission: false,
      formSubmissionId: null,
    });
  }
  return map;
}

export async function inspectAppointment(appointmentId: string, _token?: string) {
  if (!appointmentId) return null;
  return {
    _id: appointmentId,
    date_end: null,
    form_submission_id: null,
  };
}

export async function attachFormSubmissionToAppointment(params: {
  appointmentId: string;
  submissionId: string;
  clientToken?: string;
}): Promise<boolean> {
  if (!params.submissionId) return false;
  return true;
}

export async function listOpenVisitsForClient(_params: {
  clientToken: string;
  clientId: number;
}): Promise<
  {
    id: string;
    hasDialog: boolean;
    hasFormSubmission: boolean;
    formSubmissionId?: string | null;
    dialogId?: string | null;
    providerId?: number | null;
    createdAt?: number;
  }[]
> {
  return [];
}

export async function pickReusableAppointmentId(params: {
  storedIds: string[];
  clientToken: string;
  clientId: number;
}): Promise<string | null> {
  return params.storedIds[0] ?? null;
}

export async function resumeStoredAppointment(params: {
  appointmentId: string;
  clientToken: string;
  clientId?: number;
}): Promise<string> {
  return params.appointmentId;
}

export async function claimStoredAppointment(params: {
  appointmentId: string;
  clientId: number;
  clientToken: string;
}): Promise<string> {
  return params.appointmentId;
}

export function buildConsultationEmbedUrl(params: { token: string; appointmentId: string }) {
  return `/consultations/open/${params.appointmentId}`;
}

export async function fetchQuickbloxUserName(userId: number): Promise<string | null> {
  if (!userId || userId <= 0) return null;
  if (userId === 142814409) return "Admin";

  const cfg = getQuickbloxConfig();
  try {
    const adminSession = await createQbRestSession({
      email: cfg.providerEmail,
      password: cfg.providerPassword,
    });
    const res = await fetch(`${cfg.apiUrl}/users/${userId}.json`, {
      method: "GET",
      headers: {
        "QB-Token": adminSession.token,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { user?: { full_name?: string } };
      if (json.user?.full_name?.trim()) {
        return json.user.full_name.trim();
      }
    }
  } catch {
    // Non-fatal
  }

  return userId === cfg.providerId ? "Provider" : "Healthcare Provider";
}
