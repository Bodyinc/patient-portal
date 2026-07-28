"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { evaluateMedicineEligibility, saveQuestionnaireResponses } from "@/lib/actions/intake";
import { isQuestionAnswered } from "@/lib/intake/questionnaire";
import type { QuestionnaireAnswerValue, QuestionnaireResponseInput } from "@/lib/intake/types";

import OnboardingStepLayout from "../_components/OnboardingStepLayout";
import QuestionInput from "../_components/QuestionInput";
import { useQuestionnaire } from "../_hooks/use-intake-catalog";
import {
  getNextStepPath,
  getPrevStepPath,
  pushOnboardingRoute,
  replaceOnboardingRoute,
} from "../_lib/onboarding-navigation";
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
    isSuccess,
    isError,
    error,
    refetch,
  } = useQuestionnaire(state.goalId);

  useEffect(() => {
    if (!hydrated) return;
    setAnswers(normalizeStoredAnswers(state.questionnaireAnswers));
  }, [hydrated, state.questionnaireAnswers]);

  useEffect(() => {
    if (!hydrated || isLoading) return;

    if (questionnaire) {
      if (!state.requiresQuestionnaire || state.questionnaireComplete) {
        updateState({ requiresQuestionnaire: true, questionnaireComplete: false });
      }
      return;
    }

    if (!isSuccess || questionnaire !== null) return;

    if (state.requiresQuestionnaire) {
      updateState({ requiresQuestionnaire: false, questionnaireComplete: true });
      toast.error("No questionnaire is available for this goal.");
    }
    replaceOnboardingRoute(router, "/onboarding/select-plan");
  }, [
    hydrated,
    isLoading,
    isSuccess,
    questionnaire,
    router,
    state.questionnaireComplete,
    state.requiresQuestionnaire,
    updateState,
  ]);

  function updateAnswer(questionId: string, value: QuestionnaireAnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleContinue() {
    if (!questionnaire || !state.medicationId) {
      await pushOnboardingRoute(router, "/onboarding/select-plan");
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
      await pushOnboardingRoute(router, "/onboarding/medications");
      return;
    }

    const patch = {
      questionnaireAnswers: answers,
      eligibilityResult: eligibilityResult.data.result,
      questionnaireComplete: true,
    };
    updateState(patch);
    const next = getNextStepPath("/onboarding/questionnaire", { ...state, ...patch });
    if (next) await pushOnboardingRoute(router, next);
  }

  async function handleBack() {
    const prev = getPrevStepPath("/onboarding/questionnaire", state);
    if (prev) await pushOnboardingRoute(router, prev);
  }

  if (!hydrated || !state.goalId || isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-[14px] text-[#152A51]/70 onboarding-font">Loading questionnaire…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
        <p className="text-center text-[14px] text-red-600 onboarding-font">
          {error instanceof Error ? error.message : "Could not load questionnaire."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-[14px] font-medium text-[#152A51] underline onboarding-font"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!questionnaire || !state.medicationId) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-[14px] text-[#152A51]/70 onboarding-font">Redirecting…</p>
      </div>
    );
  }

  return (
    <OnboardingStepLayout
      title={questionnaire.title}
      description="A short screening is required for your selected health goal. Answer each question below."
      onBack={handleBack}
      onContinue={handleContinue}
      continueLabel="Continue"
      continueDisabled={saving}
      maxWidth="2xl"
      variant="bare"
      align="center"
      layout="fill"
    >
      <div className="space-y-6 pb-2 text-left sm:space-y-7">
        {questionnaire.questions.map((question, index) => (
          <div key={question.id} className="space-y-2.5">
            <p className="text-[15px] font-medium leading-snug text-[#152A51] sm:text-[16px]">
              {index + 1}. {question.text}
              {question.isRequired ? <span className="text-red-500"> *</span> : null}
            </p>
            {question.description ? (
              <p className="text-[13px] leading-snug text-[#152A51]/70">{question.description}</p>
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
  );
}
