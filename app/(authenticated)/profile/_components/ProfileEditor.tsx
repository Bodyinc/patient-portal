"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  updateMyProfile,
  uploadProfileAvatar,
  type EditableProfileDto,
} from "@/lib/actions/profile";
import { PROFILE_AVATAR_MAX_BYTES, PROFILE_AVATAR_MAX_LABEL } from "@/lib/profile/avatar";
import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import { fieldControlClass, fieldLabelClass } from "../../../onboarding/_lib/onboarding-theme";

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

type Field = {
  key: Exclude<keyof EditableProfileDto, "id" | "avatarUrl">;
  label: string;
  type?: "text" | "email" | "date";
  kind?: "input" | "select-sex";
  readOnly?: boolean;
  hint?: string;
  autoFocus?: boolean;
  action?: { label: string; href: string };
};

function Section({
  title,
  fields,
  form,
  onChange,
}: {
  title: string;
  fields: Field[];
  form: EditableProfileDto;
  onChange: (key: Exclude<keyof EditableProfileDto, "id" | "avatarUrl">, value: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
      <h2 className="text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
        {title}
      </h2>
      <div className="mt-3 h-px bg-[#E8EEED]" />
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className={fieldLabelClass}>{field.label}</label>
              {field.action ? (
                <Link
                  href={field.action.href}
                  className="text-[12px] font-medium text-[#152A51] underline underline-offset-2"
                >
                  {field.action.label}
                </Link>
              ) : null}
            </div>
            {field.kind === "select-sex" ? (
              <select
                value={form.sex ?? ""}
                onChange={(e) => onChange("sex", e.target.value)}
                className={`w-full ${fieldControlClass}`}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <input
                type={field.type ?? "text"}
                value={(form[field.key] as string) ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                readOnly={field.readOnly}
                disabled={field.readOnly}
                autoFocus={field.autoFocus}
                className={`w-full ${fieldControlClass} ${
                  field.readOnly ? "cursor-not-allowed opacity-60" : ""
                }`}
              />
            )}
            {field.hint ? <p className="text-[12px] text-[#152A51]/50">{field.hint}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

export default function ProfileEditor({ initialProfile }: { initialProfile: EditableProfileDto }) {
  const [form, setForm] = useState<EditableProfileDto>(initialProfile);
  const [avatarPreview, setAvatarPreview] = useState(initialProfile.avatarUrl);
  const [saving, startSaveTransition] = useTransition();
  const [uploadingAvatar, startUploadTransition] = useTransition();

  const patientId = useMemo(() => toPatientId(form.id), [form.id]);
  const fullName = form.fullName.trim() || "—";
  const external = avatarPreview ? isExternalMedicineImage(avatarPreview) : false;

  function updateField(key: Exclude<keyof EditableProfileDto, "id" | "avatarUrl">, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: key === "sex" ? ((value || null) as EditableProfileDto["sex"]) : value,
    }));
  }

  function onAvatarSelect(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed.");
      return;
    }

    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      toast.error(`Image exceeds ${PROFILE_AVATAR_MAX_LABEL}. Please choose a smaller photo.`);
      return;
    }

    const previousPreview = form.avatarUrl;
    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);

    startUploadTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const result = await uploadProfileAvatar(fd);
        if (!result.ok) {
          setAvatarPreview(previousPreview);
          toast.error(result.message);
          return;
        }

        setForm((prev) => ({ ...prev, avatarUrl: result.data.avatarUrl }));
        setAvatarPreview(result.data.avatarUrl);
        toast.success("Avatar uploaded");
      } catch {
        setAvatarPreview(previousPreview);
        toast.error(`Image exceeds ${PROFILE_AVATAR_MAX_LABEL}. Please choose a smaller photo.`);
      } finally {
        URL.revokeObjectURL(localPreview);
      }
    });
  }

  function onSave() {
    startSaveTransition(async () => {
      const result = await updateMyProfile({
        fullName: form.fullName,
        phone: form.phone,
        dob: form.dob,
        sex: form.sex,
        stateCode: form.stateCode,
        streetAddress: form.streetAddress,
        apartment: form.apartment,
        city: form.city,
        postalCode: form.postalCode,
        country: form.country,
        avatarUrl: form.avatarUrl,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setForm(result.data);
      setAvatarPreview(result.data.avatarUrl);
      toast.success("Profile updated successfully");
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="flex w-full flex-col gap-6">
        <section className="space-y-2">
          <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[28px]">
            Profile Information
          </h1>
          <p className="text-sm text-[#152A51]/80 sm:text-[15px]">
            Manage your personal and contact information.
          </p>
        </section>

        <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {avatarPreview ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
                  <Image
                    src={avatarPreview}
                    alt={fullName}
                    fill
                    sizes="56px"
                    unoptimized={external || avatarPreview.startsWith("blob:")}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E8EEED] text-base font-medium text-[#152A51]">
                  {fullName !== "—" ? initialsFromName(fullName) : "P"}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-medium tracking-[-0.3px] text-[#152A51] sm:text-[22px]">
                  {fullName}
                </p>
                <p className="text-sm text-[#152A51]/60">Patient ID: {patientId}</p>
              </div>
            </div>
            <label className="cursor-pointer text-sm font-medium text-[#152A51] underline underline-offset-2">
              {uploadingAvatar ? "Uploading..." : "Change Avatar"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  onAvatarSelect(selected);
                }}
              />
            </label>
          </div>
        </section>

        <Section
          title="General Information"
          form={form}
          onChange={updateField}
          fields={[
            { key: "fullName", label: "Full Name", autoFocus: true },
            { key: "sex", label: "Gender", kind: "select-sex" },
            { key: "dob", label: "Date of Birth", type: "date" },
          ]}
        />

        <Section
          title="Contact Information"
          form={form}
          onChange={updateField}
          fields={[
            {
              key: "email",
              label: "Email Address",
              type: "email",
              readOnly: true,
              action: { label: "Change email", href: "/profile/change-email" },
            },
            { key: "phone", label: "Phone Number" },
          ]}
        />

        <Section
          title="Address Information"
          form={form}
          onChange={updateField}
          fields={[
            { key: "streetAddress", label: "Street Address" },
            { key: "apartment", label: "Apartment Number" },
            { key: "city", label: "City" },
            { key: "stateCode", label: "State" },
            { key: "postalCode", label: "ZIP Code" },
            { key: "country", label: "Country" },
          ]}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || uploadingAvatar}
            className="h-[46px] w-full rounded-full bg-[#E3E084] px-6 text-sm font-medium text-[#152A51] hover:bg-[#D9D674] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </main>
  );
}
