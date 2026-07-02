"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { evaluateMedicineEligibility, saveQuestionnaireResponses } from "@/lib/actions/intake";
import { isQuestionAnswered } from "@/lib/intake/questionnaire";
import type { QuestionnaireAnswerValue, QuestionnaireResponseInput } from "@/lib/intake/types";

import OnboardingShell from "../_components/OnboardingShell";
import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import QuestionInput from "../_components/QuestionInput";
import { useQuestionnaire } from "../_hooks/use-intake-catalog";
import { getNextStepPath, getPrevStepPath } from "../_lib/onboarding-navigation";
import { useOnboarding } from "../_lib/onboarding-store";

function toResponseInput(
  questionId: string,
  questionType: string,
  answer: QuestionnaireAnswerValue,
): QuestionnaireResponseInput {
  const base = { questionId };

  switch (questionType) {
    case "text":
      return { ...base, answerText: answer.text?.trim() ?? null };
    case "number":
      return { ...base, answerNumber: answer.number ?? null };
    case "boolean":
      return { ...base, answerBoolean: answer.boolean ?? null };
    case "single_select":
    case "multi_select":
      return { ...base, optionIds: answer.optionIds ?? [] };
    default:
      return { ...base, answerText: answer.text?.trim() ?? null };
  }
}

function normalizeStoredAnswers(
  stored: Record<string, QuestionnaireAnswerValue | string[]>,
): Record<string, QuestionnaireAnswerValue> {
  return Object.fromEntries(
    Object.entries(stored).map(([questionId, value]) => {
      if (Array.isArray(value)) {
        return [questionId, { optionIds: value }];
      }
      return [questionId, value];
    }),
  );
}

export default function QuestionnairePage() {
  const router = useRouter();
  const { state, updateState, hydrated } = useOnboarding();
  const [answers, setAnswers] = useState<Record<string, QuestionnaireAnswerValue>>(() =>
    normalizeStoredAnswers(state.questionnaireAnswers),
  );
  const [saving, setSaving] = useState(false);

  const {
    data: questionnaire,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuestionnaire(state.medicationId);

  useEffect(() => {
    if (!hydrated) return;
    setAnswers(normalizeStoredAnswers(state.questionnaireAnswers));
  }, [hydrated, state.questionnaireAnswers]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.requiresQuestionnaire) {
      router.replace("/onboarding/select-plan");
    }
  }, [hydrated, router, state.requiresQuestionnaire]);

  useEffect(() => {
    if (!hydrated || isLoading) return;
    if (state.requiresQuestionnaire && state.medicationId && questionnaire === null) {
      toast.error("No questionnaire is available for this medication.");
      router.replace("/onboarding/select-plan");
    }
  }, [hydrated, isLoading, questionnaire, router, state.medicationId, state.requiresQuestionnaire]);

  function updateAnswer(questionId: string, value: QuestionnaireAnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleContinue() {
    if (!questionnaire || !state.medicationId) {
      router.push("/onboarding/select-plan");
      return;
    }

    for (const question of questionnaire.questions) {
      if (question.isRequired && !isQuestionAnswered(question.questionType, answers[question.id])) {
        toast.error("Please answer all required questions before continuing");
        return;
      }
    }

    setSaving(true);
    const responses = questionnaire.questions.map((q) =>
      toResponseInput(q.id, q.questionType, answers[q.id] ?? {}),
    );

    const saveResult = await saveQuestionnaireResponses(state.medicationId, responses);
    if (!saveResult.ok) {
      setSaving(false);
      toast.error(saveResult.message);
      return;
    }

    const eligibilityResult = await evaluateMedicineEligibility(state.medicationId);
    setSaving(false);

    if (!eligibilityResult.ok) {
      toast.error(eligibilityResult.message);
      return;
    }

    if (eligibilityResult.data.result === "ineligible") {
      toast.error(eligibilityResult.data.reason ?? "You are not eligible for this medication.");
      updateState({
        questionnaireAnswers: answers,
        eligibilityResult: eligibilityResult.data.result,
        questionnaireComplete: false,
      });
      router.push("/onboarding/medications");
      return;
    }

    const patch = {
      questionnaireAnswers: answers,
      eligibilityResult: eligibilityResult.data.result,
      questionnaireComplete: true,
    };
    updateState(patch);
    const next = getNextStepPath("/onboarding/questionnaire", { ...state, ...patch });
    if (next) router.push(next);
  }

  function handleBack() {
    const prev = getPrevStepPath("/onboarding/questionnaire", state);
    if (prev) router.push(prev);
  }

  if (!hydrated || isLoading) {
    return (
      <OnboardingShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#2E00AB]/70">Loading questionnaire…</p>
        </div>
      </OnboardingShell>
    );
  }

  if (isError) {
    return (
      <OnboardingShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : "Could not load questionnaire."}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-sm font-medium text-[#2E00AB] underline"
          >
            Try again
          </button>
        </div>
      </OnboardingShell>
    );
  }

  if (!questionnaire || !state.medicationId) {
    return (
      <OnboardingShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#2E00AB]/70">Redirecting…</p>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell>
      <OnboardingStepLayout
        title={questionnaire.title}
        description="A short screening is required for your selected medication. Answer each question below."
        onBack={handleBack}
        onContinue={handleContinue}
        continueDisabled={saving}
        maxWidth="4xl"
        layout="fill"
      >
        <div className="space-y-5 pb-2">
          {questionnaire.questions.map((question, index) => (
            <div key={question.id} className="space-y-3">
              <p className="text-sm font-medium text-[#2E00AB] sm:text-base">
                {index + 1}. {question.text}
                {question.isRequired ? <span className="text-red-500"> *</span> : null}
              </p>
              {question.description ? (
                <p className="text-sm text-[#2E00AB]/70">{question.description}</p>
              ) : null}
              <QuestionInput
                question={question}
                value={answers[question.id]}
                onChange={(value) => updateAnswer(question.id, value)}
              />
            </div>
          ))}
        </div>
      </OnboardingStepLayout>
    </OnboardingShell>
  );
}
