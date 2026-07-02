import "server-only";

import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

export const INTAKE_SESSION_COOKIE = "bodyinc-intake-token";
export const INTAKE_SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export type IntakeSessionRow = Tables<"intake_sessions">;

export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(INTAKE_SESSION_COOKIE)?.value ?? null;
}

export async function setSessionTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(INTAKE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INTAKE_SESSION_MAX_AGE,
  });
}

export async function clearSessionTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(INTAKE_SESSION_COOKIE);
}

export async function resolveIntakeSession(
  token: string,
  options?: { allowCompleted?: boolean },
): Promise<{ session: IntakeSessionRow | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("intake_sessions")
    .select("*")
    .eq("session_token", token)
    .maybeSingle();

  if (error) {
    return { session: null, error: error.message };
  }

  if (!data) {
    return { session: null, error: "Session not found" };
  }

  if (new Date(data.expires_at) <= new Date()) {
    return { session: null, error: "Session expired" };
  }

  const isActive =
    data.status === "in_progress" || (options?.allowCompleted && data.status === "completed");

  if (!isActive) {
    return { session: null, error: "Session is no longer active" };
  }

  return { session: data, error: null };
}

export async function requireIntakeSession(): Promise<
  { session: IntakeSessionRow } | { error: string }
> {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return { error: "No intake session" };
  }

  const { session, error } = await resolveIntakeSession(token);
  if (!session || error) {
    return { error: error ?? "Invalid session" };
  }

  return { session };
}

export async function createIntakeSession(): Promise<
  { session: IntakeSessionRow; token: string } | { error: string }
> {
  const token = crypto.randomUUID();

  const { data, error } = await supabaseAdmin
    .from("intake_sessions")
    .insert({ session_token: token })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create intake session" };
  }

  await setSessionTokenCookie(token);
  return { session: data, token };
}
