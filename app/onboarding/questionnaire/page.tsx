"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { saveQuestionnaireResponses } from "@/lib/actions/intake";
import { booleanAnswerIsDisqualifying, isQuestionAnswered } from "@/lib/intake/questionnaire";
import type {
  QuestionDto,
  QuestionnaireAnswerValue,
  QuestionnaireResponseInput,
} from "@/lib/intake/types";

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

function findDisqualifyingAnswer(
  questions: QuestionDto[],
  answers: Record<string, QuestionnaireAnswerValue>,
): string | null {
  for (const question of questions) {
    const answer = answers[question.id];
    if (
      question.questionType === "boolean" &&
      (answer?.boolean === true || answer?.boolean === false) &&
      booleanAnswerIsDisqualifying(answer.boolean, question.disqualifyRules ?? {})
    ) {
      return question.text;
    }
  }
  return null;
}

export default function QuestionnairePage() {
  const router = useRouter();
  const { state, updateState, hydrated } = useOnboarding();
  const [answers, setAnswers] = useState<Record<string, QuestionnaireAnswerValue>>(() =>
    normalizeStoredAnswers(state.questionnaireAnswers),
  );
  const [saving, setSaving] = useState(false);
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(
    state.eligibilityResult === "ineligible" && Object.keys(state.questionnaireAnswers).length > 0
      ? "Based on your answers, you are not eligible for this treatment."
      : null,
  );

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
      // Discovering a questionnaire should mark it as required, but must not erase a
      // completion that was just saved.
      if (!state.requiresQuestionnaire) {
        updateState({ requiresQuestionnaire: true });
      }
      return;
    }

    if (!isSuccess || questionnaire !== null) return;

    // No questionnaire for this goal — skip to personal info.
    updateState({ requiresQuestionnaire: false, questionnaireComplete: true });
    replaceOnboardingRoute(router, "/onboarding/personal-info");
  }, [
    hydrated,
    isLoading,
    isSuccess,
    questionnaire,
    router,
    state.requiresQuestionnaire,
    updateState,
  ]);

  function updateAnswer(questionId: string, value: QuestionnaireAnswerValue) {
    setIneligibleReason(null);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleContinue() {
    if (!questionnaire) {
      pushOnboardingRoute(router, "/onboarding/personal-info");
      return;
    }

    for (const question of questionnaire.questions) {
      if (question.isRequired && !isQuestionAnswered(question.questionType, answers[question.id])) {
        toast.error("Please answer all required questions before continuing");
        return;
      }
    }

    if (
      state.questionnaireComplete &&
      state.eligibilityResult !== "ineligible" &&
      JSON.stringify(answers) === JSON.stringify(normalizeStoredAnswers(state.questionnaireAnswers))
    ) {
      const next = getNextStepPath("/onboarding/questionnaire", {
        ...state,
        questionnaireComplete: true,
      });
      if (next) pushOnboardingRoute(router, next);
      return;
    }

    setSaving(true);
    const responses = questionnaire.questions.map((q) =>
      toResponseInput(q.id, q.questionType, answers[q.id] ?? {}),
    );

    // Goal-level save/evaluate — medicine is chosen later in the flow.
    const saveResult = await saveQuestionnaireResponses(null, responses);
    if (!saveResult.ok) {
      setSaving(false);
      toast.error(saveResult.message);
      return;
    }

    const eligibility = saveResult.data.eligibility;

    if (
      eligibility.result === "ineligible" ||
      findDisqualifyingAnswer(questionnaire.questions, answers)
    ) {
      setSaving(false);
      const reason =
        eligibility.reason ?? "Based on your answers, you are not eligible for this treatment.";
      setIneligibleReason(reason);
      toast.error(reason);
      updateState({
        questionnaireAnswers: answers,
        eligibilityResult: "ineligible",
        questionnaireComplete: false,
      });
      // Stay on questionnaire — do not open personal info / shipping / medicine.
      return;
    }

    setIneligibleReason(null);

    const patch = {
      questionnaireAnswers: answers,
      eligibilityResult: eligibility.result,
      questionnaireComplete: true,
    };
    updateState(patch);
    const next = getNextStepPath("/onboarding/questionnaire", { ...state, ...patch });
    if (next) pushOnboardingRoute(router, next);
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

  if (!questionnaire) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-[14px] text-[#152A51]/70 onboarding-font">Redirecting…</p>
      </div>
    );
  }

  const disqualifyingPrompt = findDisqualifyingAnswer(questionnaire.questions, answers);
  const blockedReason =
    ineligibleReason ??
    (disqualifyingPrompt
      ? "Based on your answers, you are not eligible for this treatment."
      : null);

  return (
    <OnboardingStepLayout
      title={questionnaire.title}
      description="A short screening is required for your selected health goal. Answer each question below."
      backHref={getPrevStepPath("/onboarding/questionnaire", state)}
      onContinue={handleContinue}
      continueLabel="Continue"
      continueDisabled={saving}
      maxWidth="2xl"
      variant="bare"
      align="center"
      layout="fill"
    >
      <div className="space-y-6 pb-6 text-left sm:space-y-7">
        {questionnaire.questions.map((question, index) => (
          <div key={question.id} className="space-y-4">
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
        {blockedReason ? (
          <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-4 text-center">
            <p className="text-sm font-medium text-amber-900">{blockedReason}</p>
            <p className="mt-1 text-sm text-amber-800">
              Change a disqualifying answer, go back, or choose a different health goal.
            </p>
          </div>
        ) : null}
      </div>
    </OnboardingStepLayout>
  );
}
