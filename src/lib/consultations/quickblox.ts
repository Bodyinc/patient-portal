import "server-only";

import { createHmac } from "node:crypto";

import { getQuickbloxConfig } from "./config";

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

let providerSessionCache: { token: string; userId: number; expiresAt: number } | null = null;

function qbPasswordForUser(userId: string) {
  const { userSecret } = getQuickbloxConfig();
  const digest = createHmac("sha256", userSecret).update(userId).digest("base64url");
  return `Bi.${digest.slice(0, 24)}!`;
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

  const res = await fetch(`${apiUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
    cache: "no-store",
  });

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
    const message = err.message || err.error || `QuickBlox request failed (${res.status})`;
    const error = new Error(message) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return json as T;
}

async function login(role: "client" | "provider", email: string, password: string) {
  const result = await qbFetch<{ session: QbSession; data: QbUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ role, email, password }),
  });
  return { token: result.session.token, user: result.data };
}

async function getProviderAuth() {
  const cfg = getQuickbloxConfig();
  const now = Date.now();
  if (providerSessionCache && providerSessionCache.token && providerSessionCache.expiresAt > now) {
    return providerSessionCache;
  }

  if (cfg.providerEmail && cfg.providerPassword) {
    const { token, user } = await login("provider", cfg.providerEmail, cfg.providerPassword);
    providerSessionCache = {
      token,
      userId: cfg.providerId ?? user.id,
      expiresAt: now + 90 * 60 * 1000,
    };
    return providerSessionCache;
  }

  if (cfg.apiKey && cfg.providerId) {
    return { token: cfg.apiKey, userId: cfg.providerId, expiresAt: now + 90 * 60 * 1000 };
  }

  throw new Error("QuickBlox provider credentials are not configured.");
}

function normalizeFullName(name: string) {
  const trimmed = name.trim() || "Patient";
  return trimmed.length >= 3 ? trimmed.slice(0, 60) : `${trimmed} Patient`.slice(0, 60);
}

function qbGender(sex: string | null | undefined): "male" | "female" {
  return sex === "female" ? "female" : "male";
}

export async function ensureQuickbloxClient(params: {
  userId: string;
  email: string;
  fullName: string;
  dob: string;
  sex: string | null;
  phone?: string | null;
}) {
  const password = qbPasswordForUser(params.userId);
  const email = params.email.trim().toLowerCase();

  try {
    const created = await qbFetch<{ session: QbSession; user: QbUser }>("/users/client", {
      method: "POST",
      body: JSON.stringify({
        full_name: normalizeFullName(params.fullName),
        email,
        password,
        birthdate: params.dob,
        gender: qbGender(params.sex),
        ...(params.phone ? { phone: params.phone } : {}),
      }),
    });
    return { token: created.session.token, userId: created.user.id };
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status !== 422 && status !== 409) throw error;
  }

  const existing = await login("client", email, password);
  return { token: existing.token, userId: existing.user.id };
}

function isAppointmentOpen(appointment: QbAppointment) {
  return appointment.date_end == null || appointment.date_end === "";
}

async function closeOpenAppointments(params: {
  clientToken: string;
  previousAppointmentIds: string[];
}) {
  let items: QbAppointment[] = [];
  try {
    const listed = await qbFetch<{ items?: QbAppointment[] }>("/appointments/my?limit=50", {
      token: params.clientToken,
    });
    items = listed.items ?? [];
  } catch (error) {
    console.warn("[consultations] list my appointments failed:", error);
  }

  const ids = new Set(params.previousAppointmentIds.filter(Boolean));
  for (const appointment of items) {
    if (appointment._id && isAppointmentOpen(appointment)) ids.add(appointment._id);
  }

  await Promise.all(
    [...ids].map((id) =>
      qbFetch(`/appointments/${id}`, {
        method: "PATCH",
        token: params.clientToken,
        body: JSON.stringify({ date_end: new Date().toISOString() }),
      }).catch((error) => {
        console.warn("[consultations] close appointment failed:", id, error);
      }),
    ),
  );
}

export async function createQuickbloxAppointment(params: {
  clientId: number;
  clientToken: string;
  description: string;
  previousAppointmentIds?: string[];
}) {
  const provider = await getProviderAuth();
  // QuickBlox allows only one open appointment between the same patient and provider.
  try {
    return await qbFetch<QbAppointment>("/appointments", {
      method: "POST",
      token: params.clientToken,
      body: JSON.stringify({
        provider_id: provider.userId,
        client_id: params.clientId,
        description: params.description.slice(0, 500),
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = (error as Error & { status?: number }).status;
    if (/active appointment/i.test(message)) {
      await closeOpenAppointments({
        clientToken: params.clientToken,
        previousAppointmentIds: params.previousAppointmentIds ?? [],
      });
      return qbFetch<QbAppointment>("/appointments", {
        method: "POST",
        token: params.clientToken,
        body: JSON.stringify({
          provider_id: provider.userId,
          client_id: params.clientId,
          description: params.description.slice(0, 500),
        }),
      });
    }
    if (status !== 401 && status !== 403) throw error;
    return qbFetch<QbAppointment>("/appointments", {
      method: "POST",
      token: provider.token,
      body: JSON.stringify({
        provider_id: provider.userId,
        client_id: params.clientId,
        description: params.description.slice(0, 500),
      }),
    });
  }
}

export function buildConsultationEmbedUrl(params: { token: string; appointmentId: string }) {
  const { clientAppUrl } = getQuickbloxConfig();
  const url = new URL(`${clientAppUrl}/appointment/${params.appointmentId}`);
  url.searchParams.set("token", params.token);
  return url.toString();
}

export async function loginQuickbloxClient(email: string, userId: string) {
  return login("client", email.trim().toLowerCase(), qbPasswordForUser(userId));
}
