"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  updateMyProfile,
  uploadProfileAvatar,
  type EditableProfileDto,
} from "@/lib/actions/profile";
import { RequiredMark } from "@/components/required-mark";
import { ZipCodeInput } from "@/components/zip-code-input";
import { PhoneField } from "@/components/phone-field";
import { PROFILE_AVATAR_MAX_BYTES, PROFILE_AVATAR_MAX_LABEL } from "@/lib/profile/avatar";
import {
  isUsStateCode,
  US_COUNTRY_CODE,
  US_COUNTRY_NAME,
  US_STATES,
} from "@/lib/profile/us-states";
import { isExternalMedicineImage } from "@/lib/intake/medicine-image";
import OnboardingDobField from "../../../onboarding/_components/OnboardingDobField";
import { fieldControlClass, fieldLabelClass } from "../../../onboarding/_lib/onboarding-theme";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  digitsOnlyPhone,
  digitsOnlyZip,
  isValidNationalPhone,
  OPTIONAL_DOB_SCHEMA,
} from "@/lib/validation";

function toPatientId(userId: string) {
  const compact = userId.replace(/-/g, "").toUpperCase();
  return `#BI-${compact.slice(0, 4)}`;
}

type ProfileFieldKey = Exclude<keyof EditableProfileDto, "id" | "avatarUrl">;

type Field = {
  key: ProfileFieldKey;
  label: string;
  type?: "text" | "email" | "date";
  kind?: "input" | "select-sex" | "select-state" | "phone" | "country" | "dob";
  readOnly?: boolean;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  autoFocus?: boolean;
  action?: { label: string; href: string };
};

function Section({
  title,
  fields,
  form,
  errors,
  onChange,
}: {
  title: string;
  fields: Field[];
  form: EditableProfileDto;
  errors: Partial<Record<ProfileFieldKey, string>>;
  onChange: (key: ProfileFieldKey, value: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-[#E8EEED] bg-white p-4 sm:p-6">
      <h2 className="text-[26px] font-medium tracking-[-0.3px] text-[#152A51]">{title}</h2>
      <div className="mt-3 h-px bg-[#E8EEED]" />
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        {fields.map((field) => {
          const message = errors[field.key];
          const invalidClass = message ? "ring-1 ring-inset ring-red-400" : "";
          return (
            <div key={field.key} className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className={fieldLabelClass} htmlFor={`profile-${field.key}`}>
                  {field.label} {field.required ? <RequiredMark /> : null}
                  {field.optional ? (
                    <span className="font-normal text-[#152A51]/50"> (optional)</span>
                  ) : null}
                </label>
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
                  id={`profile-${field.key}`}
                  value={form.sex ?? ""}
                  onChange={(e) => onChange("sex", e.target.value)}
                  aria-invalid={message ? true : undefined}
                  className={`w-full ${fieldControlClass} ${invalidClass}`}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              ) : field.kind === "select-state" ? (
                <select
                  id={`profile-${field.key}`}
                  value={isUsStateCode(form.stateCode) ? form.stateCode.toUpperCase() : ""}
                  onChange={(e) => onChange("stateCode", e.target.value)}
                  aria-required={field.required}
                  aria-invalid={message ? true : undefined}
                  className={`w-full ${fieldControlClass} ${invalidClass}`}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              ) : field.kind === "country" ? (
                <input
                  id={`profile-${field.key}`}
                  value={US_COUNTRY_NAME}
                  readOnly
                  disabled
                  aria-readonly="true"
                  className={`w-full ${fieldControlClass} cursor-not-allowed`}
                />
              ) : field.kind === "dob" ? (
                <OnboardingDobField
                  id={`profile-${field.key}`}
                  value={form.dob}
                  onChange={(iso) => onChange("dob", iso)}
                  inputClassName={`${fieldControlClass} ${invalidClass}`}
                />
              ) : field.kind === "phone" ? (
                <PhoneField
                  id={`profile-${field.key}`}
                  phone={form.phone}
                  phoneCountryCode={DEFAULT_PHONE_COUNTRY_CODE}
                  onPhoneChange={(phone) => onChange("phone", phone)}
                  ariaInvalid={Boolean(message)}
                  ariaRequired={field.required}
                />
              ) : field.key === "postalCode" ? (
                <ZipCodeInput
                  id={`profile-${field.key}`}
                  value={form.postalCode}
                  onChange={(value) => onChange("postalCode", value)}
                  aria-required={field.required}
                  aria-invalid={message ? true : undefined}
                  className={`w-full ${fieldControlClass} ${invalidClass}`}
                />
              ) : (
                <input
                  id={`profile-${field.key}`}
                  type={field.type ?? "text"}
                  value={(form[field.key] as string) ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  readOnly={field.readOnly}
                  disabled={field.readOnly}
                  autoFocus={field.autoFocus}
                  required={field.required}
                  aria-required={field.required}
                  aria-invalid={message ? true : undefined}
                  autoComplete={
                    field.key === "streetAddress"
                      ? "address-line1"
                      : field.key === "apartment"
                        ? "address-line2"
                        : field.key === "city"
                          ? "address-level2"
                          : undefined
                  }
                  className={`w-full ${fieldControlClass} ${invalidClass} ${
                    field.readOnly ? "cursor-not-allowed opacity-60" : ""
                  }`}
                />
              )}
              {message ? <p className="text-[12px] text-red-600">{message}</p> : null}
              {field.hint ? <p className="text-[12px] text-[#152A51]/50">{field.hint}</p> : null}
            </div>
          );
        })}
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
  const router = useRouter();
  const [form, setForm] = useState<EditableProfileDto>(() => ({
    ...initialProfile,
    phone: digitsOnlyPhone(initialProfile.phone, DEFAULT_PHONE_COUNTRY_CODE),
    postalCode: digitsOnlyZip(initialProfile.postalCode),
  }));
  const [avatarPreview, setAvatarPreview] = useState(initialProfile.avatarUrl);
  const [saving, startSaveTransition] = useTransition();
  const [uploadingAvatar, startUploadTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileFieldKey, string>>>({});

  const patientId = useMemo(() => toPatientId(form.id), [form.id]);
  const fullName = form.fullName.trim() || "—";
  const external = avatarPreview ? isExternalMedicineImage(avatarPreview) : false;

  function updateField(key: ProfileFieldKey, value: string) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
    const next =
      key === "postalCode"
        ? digitsOnlyZip(value)
        : key === "phone"
          ? digitsOnlyPhone(value, DEFAULT_PHONE_COUNTRY_CODE)
          : value;
    setForm((prev) => ({
      ...prev,
      [key]: key === "sex" ? ((next || null) as EditableProfileDto["sex"]) : next,
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
    const nextErrors: Partial<Record<ProfileFieldKey, string>> = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Enter your full name.";
    if (!isValidNationalPhone(form.phone, DEFAULT_PHONE_COUNTRY_CODE)) {
      nextErrors.phone = "Enter a valid 10-digit phone number.";
    }
    if (form.dob.trim()) {
      const dob = OPTIONAL_DOB_SCHEMA.safeParse(form.dob);
      if (!dob.success) {
        nextErrors.dob = dob.error.issues[0]?.message ?? "Enter a valid date of birth.";
      }
    }
    if (!form.streetAddress.trim()) nextErrors.streetAddress = "Enter your street address.";
    if (!form.city.trim()) nextErrors.city = "Enter your city.";
    if (!isUsStateCode(form.stateCode)) nextErrors.stateCode = "Select your state.";
    if (!digitsOnlyZip(form.postalCode)) nextErrors.postalCode = "Enter your ZIP code.";

    setFieldErrors(nextErrors);
    const firstError = Object.values(nextErrors).find(Boolean);
    if (firstError) {
      toast.error(firstError);
      return;
    }

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
        country: US_COUNTRY_CODE,
        avatarUrl: form.avatarUrl,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setForm(result.data);
      setAvatarPreview(result.data.avatarUrl);
      toast.success("Profile updated successfully");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto w-full max-w-full flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
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
                <p className="truncate text-[26px] font-medium tracking-[-0.3px] text-[#152A51]">
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
          errors={fieldErrors}
          onChange={updateField}
          fields={[
            { key: "fullName", label: "Full Name", autoFocus: true, required: true },
            { key: "sex", label: "Gender", kind: "select-sex" },
            { key: "dob", label: "Date of Birth", kind: "dob" },
          ]}
        />

        <Section
          title="Contact Information"
          form={form}
          errors={fieldErrors}
          onChange={updateField}
          fields={[
            {
              key: "email",
              label: "Email Address",
              type: "email",
              readOnly: true,
              required: true,
              action: { label: "Change email", href: "/profile/change-email" },
            },
            { key: "phone", label: "Phone Number", kind: "phone", required: true },
          ]}
        />

        <Section
          title="Address Information"
          form={form}
          errors={fieldErrors}
          onChange={updateField}
          fields={[
            { key: "streetAddress", label: "Street Address", required: true },
            { key: "apartment", label: "Apartment Number", optional: true },
            { key: "city", label: "City", required: true },
            { key: "stateCode", label: "State", kind: "select-state", required: true },
            { key: "postalCode", label: "ZIP Code", required: true },
            {
              key: "country",
              label: "Country",
              kind: "country",
              required: true,
              hint: "We only ship within the United States.",
            },
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
