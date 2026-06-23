import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
export const Route = createFileRoute("/otp-login")({
  component: OTPLoginPage,
});

function OTPLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold">Login with OTP</h1>

        <p className="mb-6 text-sm text-gray-500">
          Enter your email address and we'll send a one-time password.
        </p>

        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button
         className="mt-4 w-full"
         onClick={async () => {
          const { error } = await supabase.auth.signInWithOtp({
            email,
           });

           if (error) {
             alert(error.message);
           } else {
             navigate({
             to: "/verify-otp",
             search: {
             email,
              },
             });
            }
             }}
            >
  Send OTP
</Button>
      </div>
    </div>
  );
}