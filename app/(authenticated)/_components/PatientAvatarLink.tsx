"use client";

import Image from "next/image";
import Link from "next/link";

import { isExternalMedicineImage } from "@/lib/intake/medicine-image";

type PatientAvatarLinkProps = {
  fullName: string;
  avatarUrl: string | null | undefined;
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

export default function PatientAvatarLink({ fullName, avatarUrl }: PatientAvatarLinkProps) {
  const name = fullName.trim() || "Patient";
  const external = avatarUrl ? isExternalMedicineImage(avatarUrl) : false;

  return (
    <Link
      href="/profile"
      aria-label="Open profile"
      className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-[#152A51]/0 transition hover:ring-2 hover:ring-[#152A51]/30 sm:h-[42px] sm:w-[42px]"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          fill
          sizes="42px"
          unoptimized={external}
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[#E8EEED] text-xs font-medium text-[#152A51] sm:text-sm">
          {initialsFromName(name)}
        </span>
      )}
    </Link>
  );
}
