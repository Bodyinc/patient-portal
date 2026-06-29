"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import {
  getMedicationById,
  getQuestionnaireForMedication,
  medicationRequiresQuestionnaire,
} from "../_lib/onboarding-config";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

export default function QuestionnairePage() {
  const router = useRouter();
  const { state, updateState } = useOnboarding();
  const [answers, setAnswers] = useState<Record<string, string[]>>(state.questionnaireAnswers);

  const medication = getMedicationById(state.medicationId);
  const questionnaire = getQuestionnaireForMedication(state.medicationId);

  useEffect(() => {
    if (!medicationRequiresQuestionnaire(state.medicationId)) {
      router.replace("/onboarding/select-plan");
    }
  }, [router, state.medicationId]);

  function toggleAnswer(questionId: string, optionId: string, checked: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (checked) {
        return { ...prev, [questionId]: [...new Set([...current, optionId])] };
      }
      return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
    });
  }

  function handleContinue() {
    if (!questionnaire) {
      router.push("/onboarding/select-plan");
      return;
    }

    for (const question of questionnaire.questions) {
      const selected = answers[question.id] ?? [];
      if (selected.length === 0) {
        toast.error("Please answer all questions before continuing");
        return;
      }
    }

    updateState({ questionnaireAnswers: answers });
    const next = getNextStepPath("/onboarding/questionnaire", {
      ...state,
      questionnaireAnswers: answers,
    });
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/questionnaire", state);
    if (prev) router.push(prev);
  }

  if (!questionnaire || !medication) {
    return null;
  }

  return (
    <OnboardingShell>
      <OnboardingStepLayout
        title={questionnaire.title}
        description={`A short screening is required for ${medication.name}. Select all that apply for each question.`}
        onBack={handleBack}
        onContinue={handleContinue}
        maxWidth="2xl"
      >
        <div className="grid gap-2 lg:grid-cols-3 lg:gap-3">
          {questionnaire.questions.map((question) => (
            <div key={question.id} className="space-y-2 rounded-xl border border-[#2E00AB]/15 p-3">
              <p className="text-sm font-medium text-[#2E00AB]">{question.text}</p>
              <div className="space-y-1.5">
                {question.options.map((option) => {
                  const checked = (answers[question.id] ?? []).includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#2E00AB]/10 px-2 py-1.5 hover:bg-[#F8F4FF]"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleAnswer(question.id, option.id, value === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="text-xs text-[#2E00AB] sm:text-sm">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
