import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string; error?: string }>;
}) {
  const { recovery, error } = await searchParams;
  return <ResetPasswordForm recovery={recovery} error={error} />;
}
