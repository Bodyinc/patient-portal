"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionDto, QuestionnaireAnswerValue } from "@/lib/intake/types";

import { getQuestionnaireGridClass } from "../_lib/onboarding-ui";

type QuestionInputProps = {
  question: QuestionDto;
  value: QuestionnaireAnswerValue | undefined;
  onChange: (value: QuestionnaireAnswerValue) => void;
};

const optionButtonClass = (selected: boolean) =>
  `flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
    selected ? "border-[#2E00AB] bg-[#2E00AB]/5" : "border-[#2E00AB]/20 hover:border-[#2E00AB]/40"
  }`;

export default function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  switch (question.questionType) {
    case "text":
      return (
        <Textarea
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type your answer"
          rows={3}
          className="min-h-[80px] resize-none border-[#2E00AB]/20 bg-white"
        />
      );

    case "number":
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={value?.number ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange({
              number: raw === "" ? null : Number(raw),
            });
          }}
          placeholder="Enter a number"
          className="border-[#2E00AB]/20 bg-white"
        />
      );

    case "boolean":
      return (
        <div className="grid max-w-md grid-cols-2 gap-2">
          {[
            { label: "Yes", val: true },
            { label: "No", val: false },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange({ boolean: option.val })}
              className={optionButtonClass(value?.boolean === option.val)}
            >
              <span className="text-sm font-medium text-[#2E00AB]">{option.label}</span>
            </button>
          ))}
        </div>
      );

    case "single_select":
      return (
        <RadioGroup
          value={value?.optionIds?.[0] ?? ""}
          onValueChange={(optionId) => onChange({ optionIds: [optionId] })}
          className="flex flex-col gap-2"
        >
          {question.options.map((option) => (
            <Label
              key={option.id}
              htmlFor={`${question.id}-${option.id}`}
              className={optionButtonClass(value?.optionIds?.[0] === option.id)}
            >
              <RadioGroupItem
                value={option.id}
                id={`${question.id}-${option.id}`}
                className="border-[#2E00AB] text-[#2E00AB]"
              />
              <span className="text-sm text-[#2E00AB]">{option.label}</span>
            </Label>
          ))}
        </RadioGroup>
      );

    case "multi_select":
    default:
      return (
        <div className={getQuestionnaireGridClass(question.options.length)}>
          {question.options.map((option) => {
            const checked = (value?.optionIds ?? []).includes(option.id);
            return (
              <label key={option.id} className={optionButtonClass(checked)}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(checkedValue) => {
                    const current = value?.optionIds ?? [];
                    if (checkedValue === true) {
                      onChange({ optionIds: [...new Set([...current, option.id])] });
                    } else {
                      onChange({ optionIds: current.filter((id) => id !== option.id) });
                    }
                  }}
                />
                <span className="text-sm text-[#2E00AB]">{option.label}</span>
              </label>
            );
          })}
        </div>
      );
  }
}
