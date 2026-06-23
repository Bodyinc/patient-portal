import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: String(search.email ?? ""),
  }),
  component: VerifyOTPPage,
});

function VerifyOTPPage() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const { email } = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm text-center">
        <h1 className="mb-2 text-3xl font-bold">
          Enter Verification Code
        </h1>

        <p className="mb-2 text-sm text-gray-500">
        Enter the code sent to
         </p>

        <p className="mb-6 font-medium">
  {email}
        </p>

        <div className="flex justify-center gap-2">
  {[0, 1, 2, 3, 4, 5,6,7].map((index) => (
    <Input
      key={index}
      maxLength={1}
      className="h-12 w-12 text-center text-lg font-semibold"
      value={otp[index] || ""}
      onChange={(e) => {
        const value = e.target.value.slice(-1);
        const otpArray = otp.split("");
        otpArray[index] = value;
        setOtp(otpArray.join(""));
      }}
    />
  ))}
</div>

        <Button
         className="mt-4 w-full"
         onClick={async () => {
         const { error } = await supabase.auth.verifyOtp({
         email,
         token: otp,
         type: "email",
         });

       if (error) {
          alert(error.message);
       } else {
         navigate({
         to: "/dashboard",
        });
        }
       }}
>
  Verify
</Button>
<button
  type="button"
  className="mt-4 text-sm text-gray-500 underline"
  onClick={async () => {
    await supabase.auth.signInWithOtp({
      email,
    });

    alert("Code resent");
  }}
>
  Resend Code
</button>
      </div>
    </div>
  );
}