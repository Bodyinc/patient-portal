"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import OnboardingShell from "../_components/OnboardingShell";
import { getQuizOutcome } from "../_lib/quiz-outcome";

const options = ["Mostly sedentary", "Lightly active", "Moderately active", "Very active"];

export default function LifestylePage() {
  const router = useRouter();
  const [selected, setSelected] = useState("");

  function handleNext() {
    if (!selected) return;
    const outcome = getQuizOutcome(selected);
    router.push(outcome === "fail" ? "/onboarding/recommend2" : "/onboarding/choose-medicine");
  }

  return (
    <OnboardingShell>
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm text-[#2E00AB]">
          <span>Question 2 of 4</span>
          <span>50% Complete</span>
        </div>

        <Progress value={50} className="h-1.5 rounded-full" />

        <Card className="mt-4 flex min-h-0 flex-1 flex-col rounded-2xl border-[#2E00AB]/20 p-5 shadow-none">
          <h1 className="text-2xl font-semibold text-[#2E00AB]">
            How would you describe your lifestyle?
          </h1>
          <p className="mt-2 text-base text-[#2E00AB]/80">
            This helps us personalize your treatment plan.
          </p>

          <div className="mt-4 flex min-h-0 flex-1 flex-col justify-center gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelected(option)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                  selected === option
                    ? "border-[#2E00AB] bg-[#2E00AB]/5"
                    : "border-[#2E00AB]/20 hover:border-[#2E00AB]"
                }`}
              >
                <span className="text-base font-medium text-[#2E00AB]">{option}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
            <Button variant="outline" className="w-full border-[#2E00AB] text-[#2E00AB] sm:w-auto">
              ← Previous
            </Button>
            <Button
              className="w-full bg-[#2E00AB] hover:bg-[#2E00AB]/90 sm:w-auto"
              disabled={!selected}
              onClick={handleNext}
            >
              Next Question →
            </Button>
          </div>
        </Card>
      </div>
    </OnboardingShell>
  );
}
