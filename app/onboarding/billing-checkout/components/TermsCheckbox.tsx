"use client";

import { useState } from "react";

export default function TermsCheckbox() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex shrink-0 items-start gap-3">
      <input
        id="terms"
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#2E00AB]"
      />

      <label htmlFor="terms" className="text-sm leading-snug text-[#2E00AB]/80">
        I agree to the <span className="cursor-pointer underline">Terms & Conditions</span> and{" "}
        <span className="cursor-pointer underline">Privacy Policy</span>
      </label>
    </div>
  );
}
