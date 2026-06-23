"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function OTPLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) {
        toast.error(error.message);
        return;
      }
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold">Login with OTP</h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter your email address and we&apos;ll send a one-time password.
        </p>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button className="mt-4 w-full" onClick={sendOtp} disabled={busy}>
          {busy ? "Sending…" : "Send OTP"}
        </Button>
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/auth" className="hover:text-black">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
