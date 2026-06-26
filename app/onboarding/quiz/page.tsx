"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const options = ["Mostly sedentary", "Lightly active", "Moderately active", "Very active"];

export default function LifestylePage() {
  const router = useRouter();

  const [selected, setSelected] = useState("");

  return (
    <main className="min-h-screen bg-white px-8 py-10">
      <Image
        src="/background-curve.svg"
        alt=""
        fill
        className="pointer-events-none object-cover opacity-40"
      />
      {/* Logo */}

      <Image src="/logo.svg" alt="Body Inc" width={170} height={60} priority />

      {/* Content */}

      <div className="max-w-5xl mx-auto mt-12">
        {/* Progress */}

        <div className="flex justify-between text-sm text-[#2E00AB] mb-2">
          <span>Question 2 of 4</span>

          <span>50% Complete</span>
        </div>

        <Progress value={50} className="h-2 rounded-full" />

        {/* Card */}

        <Card className="mt-8 rounded-3xl border-[#2E00AB]/20 p-10 shadow-none">
          <h1 className="text-[32px] font-semibold text-[#2E00AB]">
            How would you describe your lifestyle?
          </h1>

          <p className="mt-3 text-[20px] text-[#2E00AB]/80">
            This helps us personalize your treatment plan.
          </p>

          {/* Options */}

          <div className="mt-10 space-y-4">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => setSelected(option)}
                className={`

                  w-full
                  rounded-xl
                  border
                  px-6
                  py-5
                  text-left
                  transition-all

                  ${
                    selected === option
                      ? "border-[#2E00AB] bg-[#2E00AB]/5"
                      : "border-[#2E00AB]/20 hover:border-[#2E00AB]"
                  }

                `}
              >
                <span className="text-xl font-medium text-[#2E00AB]">{option}</span>
              </button>
            ))}
          </div>

          {/* Buttons */}

          <div className="mt-14 flex justify-between">
            <Button variant="outline" className="border-[#2E00AB] text-[#2E00AB]">
              ← Previous
            </Button>

            <Button
              className="bg-[#2E00AB] hover:bg-[#2E00AB]/90"
              onClick={() => router.push("/onboarding/select-medication")}
            >
              Next Question →
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
