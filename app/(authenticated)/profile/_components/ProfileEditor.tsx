"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  updateMyProfile,
  uploadProfileAvatar,
  type EditableProfileDto,
} from "@/lib/actions/profile";

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
    <section className="rounded-xl border border-[#E6DEFF] bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-[#2E00AB]">{title}</h2>
      <div className="mt-3 h-px bg-[#EEE9FF]" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#2E00AB]/70">{field.label}</label>
              {field.action ? (
                <Link
                  href={field.action.href}
                  className="text-[11px] font-semibold text-[#2E00AB] underline underline-offset-2"
                >
                  {field.action.label}
                </Link>
              ) : null}
            </div>
            {field.kind === "select-sex" ? (
              <select
                value={form.sex ?? ""}
                onChange={(e) => onChange("sex", e.target.value)}
                className="w-full rounded-md border border-[#F1ECFF] bg-[#FCFBFF] px-3 py-2 text-sm font-medium text-[#2E00AB] outline-none focus:border-[#2E00AB]/40"
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
                className={`w-full rounded-md border border-[#F1ECFF] px-3 py-2 text-sm font-medium text-[#2E00AB] outline-none focus:border-[#2E00AB]/40 ${
                  field.readOnly
                    ? "cursor-not-allowed bg-[#F3EFFF] text-[#2E00AB]/60"
                    : "bg-[#FCFBFF]"
                }`}
              />
            )}
            {field.hint ? <p className="text-[11px] text-[#2E00AB]/50">{field.hint}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProfileEditor({ initialProfile }: { initialProfile: EditableProfileDto }) {
  const [form, setForm] = useState<EditableProfileDto>(initialProfile);
  const [avatarPreview, setAvatarPreview] = useState(initialProfile.avatarUrl);
  const [saving, startSaveTransition] = useTransition();
  const [uploadingAvatar, startUploadTransition] = useTransition();

  const patientId = useMemo(() => toPatientId(form.id), [form.id]);
  const fullName = form.fullName.trim() || "—";

  function updateField(key: Exclude<keyof EditableProfileDto, "id" | "avatarUrl">, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: key === "sex" ? ((value || null) as EditableProfileDto["sex"]) : value,
    }));
  }

  function onAvatarSelect(file: File | null) {
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);

    startUploadTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadProfileAvatar(fd);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setForm((prev) => ({ ...prev, avatarUrl: result.data.avatarUrl }));
      setAvatarPreview(result.data.avatarUrl);
      toast.success("Avatar uploaded");
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
    <main className="min-w-0 flex-1 bg-[#FAF8FF] p-3 sm:p-4">
      <div className="space-y-3">
        <section className="space-y-1 px-1 pt-1">
          <h1 className="text-2xl font-semibold text-[#2E00AB]">Profile Information</h1>
          <p className="text-sm text-[#2E00AB]/70">Manage your personal and contact information.</p>
        </section>

        <section className="rounded-md border border-[#E6DEFF] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={fullName}
                  className="h-14 w-14 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#EDE7FF] text-base font-semibold text-[#2E00AB]">
                  {fullName !== "—" ? fullName.charAt(0).toUpperCase() : "P"}
                </div>
              )}
              <div>
                <p className="text-xl font-semibold text-[#2E00AB]">{fullName}</p>
                <p className="text-sm text-[#2E00AB]/70">Patient ID: {patientId}</p>
              </div>
            </div>
            <label className="cursor-pointer text-sm font-medium text-[#2E00AB] underline underline-offset-2">
              {uploadingAvatar ? "Uploading..." : "Change Avatar"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={(e) => onAvatarSelect(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </section>

        <Section
          title="General Information"
          form={form}
          onChange={updateField}
          fields={[
            { key: "fullName", label: "Full Name" },
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
            className="rounded-md bg-[#2E00AB] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </main>
  );
}
