"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  dob: z.string().trim().optional().or(z.literal("")),
  sex: z.enum(["male", "female", "other"]).nullable(),
  stateCode: z.string().trim().max(2).optional().or(z.literal("")),
  streetAddress: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
});

export type ProfileActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export type EditableProfileDto = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  sex: "male" | "female" | "other" | null;
  stateCode: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  country: string;
  avatarUrl: string;
};

function mapProfile(profile: Tables<"profiles">): EditableProfileDto {
  return {
    id: profile.id,
    fullName: profile.full_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    dob: profile.dob ?? "",
    sex: profile.sex ?? null,
    stateCode: profile.state_code ?? "",
    streetAddress: profile.street_address ?? "",
    city: profile.city ?? "",
    postalCode: profile.postal_code ?? "",
    country: profile.country ?? "",
    avatarUrl: profile.avatar_url ?? "",
  };
}

async function requireAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { supabase, user };
}

export async function getMyProfile(): Promise<ProfileActionResult<EditableProfileDto>> {
  const auth = await requireAuthedUser();
  if (!auth) {
    return { ok: false, code: "unauthenticated", message: "Sign in to continue." };
  }

  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !profile) {
    return { ok: false, code: "not_found", message: error?.message ?? "Profile not found." };
  }

  return { ok: true, data: mapProfile(profile as Tables<"profiles">) };
}

export async function updateMyProfile(
  input: z.infer<typeof profileUpdateSchema>,
): Promise<ProfileActionResult<EditableProfileDto>> {
  const auth = await requireAuthedUser();
  if (!auth) {
    return { ok: false, code: "unauthenticated", message: "Sign in to continue." };
  }

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const data = parsed.data;

  const updatePayload: Partial<Tables<"profiles">> = {
    full_name: data.fullName,
    email: data.email,
    phone: data.phone || null,
    dob: data.dob || null,
    sex: data.sex,
    state_code: data.stateCode || null,
    street_address: data.streetAddress || null,
    city: data.city || null,
    postal_code: data.postalCode || null,
    country: data.country || null,
    avatar_url: data.avatarUrl || null,
  };

  const { data: updated, error } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", auth.user.id)
    .select("*")
    .single();

  if (error || !updated) {
    return { ok: false, code: "save_error", message: error?.message ?? "Could not save profile." };
  }

  return { ok: true, data: mapProfile(updated as Tables<"profiles">) };
}

export async function uploadProfileAvatar(
  formData: FormData,
): Promise<ProfileActionResult<{ avatarUrl: string }>> {
  const auth = await requireAuthedUser();
  if (!auth) {
    return { ok: false, code: "unauthenticated", message: "Sign in to continue." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, code: "invalid_file", message: "Select an image file." };
  }

  if (!file.type.startsWith("image/")) {
    return { ok: false, code: "invalid_type", message: "Only image files are allowed." };
  }

  const maxSizeBytes = 5 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { ok: false, code: "file_too_large", message: "Image must be 5MB or smaller." };
  }

  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "png") : "png";
  const filePath = `${auth.user.id}/${Date.now()}.${ext}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from("profile-avatars")
    .upload(filePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { ok: false, code: "upload_error", message: uploadError.message };
  }

  const { data: publicData } = supabaseAdmin.storage.from("profile-avatars").getPublicUrl(filePath);

  if (!publicData.publicUrl) {
    return { ok: false, code: "url_error", message: "Could not resolve avatar URL." };
  }

  return { ok: true, data: { avatarUrl: publicData.publicUrl } };
}
