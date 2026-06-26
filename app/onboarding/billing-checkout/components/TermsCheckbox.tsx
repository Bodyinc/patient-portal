"use client";

import { useState } from "react";

export default function TermsCheckbox() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="mt-6 flex items-center gap-3">
      <input
        id="terms"
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="h-4 w-4 accent-[#2E00AB]"
      />

      <label htmlFor="terms" className="text-sm text-[#2E00AB]/80">
        I agree to the <span className="underline cursor-pointer">Terms & Conditions</span> and{" "}
        <span className="underline cursor-pointer">Privacy Policy</span>
      </label>
    </div>
  );
}
