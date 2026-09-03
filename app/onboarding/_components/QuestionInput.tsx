"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { QuestionDto, QuestionnaireAnswerValue } from "@/lib/intake/types";

import { getQuestionnaireGridClass } from "../_lib/onboarding-ui";
import { fieldControlClass, fieldTextareaClass } from "../_lib/onboarding-theme";

type QuestionInputProps = {
  question: QuestionDto;
  value: QuestionnaireAnswerValue | undefined;
  onChange: (value: QuestionnaireAnswerValue) => void;
};

const optionButtonClass = (selected: boolean) =>
  cn(
    "flex w-full cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-3",
    selected
      ? "border-[#152A51] bg-[#E8EEED]"
      : "border-[#E8E8E8] bg-white hover:border-[#152A51]/30",
  );

export default function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  switch (question.questionType) {
    case "text":
      return (
        <Textarea
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type your answer"
          rows={3}
          className={fieldTextareaClass}
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
          className={cn(fieldControlClass, "max-w-full sm:max-w-md")}
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
              <span className="text-[14px] font-medium text-[#152A51]">{option.label}</span>
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
                className="border-[#152A51] text-[#152A51]"
              />
              <span className="text-[14px] text-[#152A51]">{option.label}</span>
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
                  className="border-[#152A51]/30 data-[state=checked]:border-[#152A51] data-[state=checked]:bg-[#152A51]"
                />
                <span className="text-[14px] text-[#152A51]">{option.label}</span>
              </label>
            );
          })}
        </div>
      );
  }
}
