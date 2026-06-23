import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password · BodyInc Patient Portal" },
      { name: "description", content: "Reset your BodyInc patient account password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) return;

    setBusy(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Reset Password</h1>

          <p className="mt-3 text-gray-500">
            Enter your email address below and we'll send you
            a link to reset your password.
          </p>
        </div>

        {sent ? (
          <div className="mt-8 text-center">
            <p className="text-gray-700">
              Check your inbox for a link to set a new password.
            </p>

            <Link
              to="/auth"
              className="mt-6 block text-sm text-gray-500 hover:text-black"
            >
              ← Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fp-email">Email Address</Label>

              <Input
                id="fp-email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={busy}
            >
              {busy ? "Sending..." : "Send Verification Code"}
            </Button>

            <Link
              to="/auth"
              className="block text-center text-sm text-gray-500 hover:text-black"
            >
              ← Back to Login
            </Link>

            <p className="text-center text-sm text-gray-500">
              Can't access your email?{" "}
              <a href="#" className="underline">
                Contact Support
              </a>
            </p>
          </form>
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-gray-400">
        <div className="mb-2 flex justify-center gap-4">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Contact Support</a>
        </div>

        <p>© 2026 BodyInc</p>
      </footer>
    </div>
  );
}