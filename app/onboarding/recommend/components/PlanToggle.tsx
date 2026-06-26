"use client";

import { useState } from "react";

export default function PlanToggle() {
  const [selected, setSelected] = useState("3");

  return (
    <div className="flex justify-center mt-8 mb-8">
      <div className="flex border border-[#2E00AB]/30 rounded-md overflow-hidden">
        <button
          onClick={() => setSelected("1")}
          className={`px-8 py-3 text-sm font-semibold transition ${
            selected === "1" ? "bg-[#E6DEFF] text-[#2E00AB]" : "bg-white text-[#2E00AB]"
          }`}
        >
          1 Month Plan
        </button>

        <button
          onClick={() => setSelected("3")}
          className={`px-8 py-3 text-sm font-semibold transition ${
            selected === "3" ? "bg-[#E6DEFF] text-[#2E00AB]" : "bg-white text-[#2E00AB]"
          }`}
        >
          3 Month Plan
        </button>
      </div>
    </div>
  );
}
