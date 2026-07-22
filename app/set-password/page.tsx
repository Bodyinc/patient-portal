import { redirect } from "next/navigation";

import { hasPassword } from "@/lib/actions/patient-auth";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = next?.startsWith("/") ? next : "/dashboard";

  if (await hasPassword()) {
    redirect(destination);
  }

  return <SetPasswordForm next={destination} />;
}
