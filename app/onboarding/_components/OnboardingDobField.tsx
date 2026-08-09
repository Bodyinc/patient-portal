"use client";

import { CalendarIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MAX_SIGNUP_AGE, MIN_SIGNUP_AGE } from "@/lib/validation";

import { isoDobToDisplay } from "../_lib/dob-format";
import {
  dateToIsoDob,
  displayDobToIso,
  isoDobToDate,
  isoDobToParts,
  isValidDayDraft,
  isValidMonthDraft,
  isValidYearDraft,
  partsToIsoDob,
} from "../_lib/dob-format";

type OnboardingDobFieldProps = {
  id?: string;
  value: string;
  onChange: (isoValue: string) => void;
  inputClassName?: string;
};

type DobParts = { month: string; day: string; year: string };

function getSelectableDobRange() {
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - MIN_SIGNUP_AGE, today.getMonth(), today.getDate());
  const minDate = new Date(today.getFullYear() - MAX_SIGNUP_AGE, today.getMonth(), today.getDate());
  return { minDate, maxDate };
}

function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function padPart(value: string, length: number) {
  if (!value) return "";
  return value.padStart(length, "0");
}

export default function OnboardingDobField({
  id = "dob",
  value,
  onChange,
  inputClassName,
}: OnboardingDobFieldProps) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<DobParts>(() => isoDobToParts(value));
  const partsRef = useRef(parts);
  const emittedRef = useRef(value);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const selectedDate = isoDobToDate(value);
  const { minDate, maxDate } = getSelectableDobRange();

  partsRef.current = parts;

  // Sync only when parent value changed from outside this field (hydrate/calendar),
  // never from our own onChange emissions — that was wiping digits mid-typing.
  useEffect(() => {
    if (value === emittedRef.current) return;
    emittedRef.current = value;
    const next = isoDobToParts(value);
    partsRef.current = next;
    setParts(next);
  }, [value]);

  function emit(iso: string) {
    emittedRef.current = iso;
    onChange(iso);
  }

  function handleSegmentChange(segment: keyof DobParts, raw: string, maxLength: number) {
    const nextValue = digitsOnly(raw, maxLength);

    if (segment === "month" && !isValidMonthDraft(nextValue)) return;
    if (segment === "day" && !isValidDayDraft(nextValue)) return;
    if (segment === "year" && !isValidYearDraft(nextValue)) return;

    const nextParts = { ...partsRef.current, [segment]: nextValue };
    partsRef.current = nextParts;
    setParts(nextParts);

    const iso = partsToIsoDob(nextParts);
    if (iso) emit(iso);
  }

  function padAndEmitParts() {
    const current = partsRef.current;
    let month = padPart(current.month, 2);
    let day = padPart(current.day, 2);
    const year = current.year;

    // Drop padded values that are still out of range (e.g. "0" → "00").
    if (month && !isValidMonthDraft(month)) month = "";
    if (day && !isValidDayDraft(day)) day = "";

    const padded: DobParts = { month, day, year };
    partsRef.current = padded;
    setParts(padded);
    emit(partsToIsoDob(padded) ?? "");
  }

  function handleGroupBlur(event: React.FocusEvent<HTMLDivElement>) {
    // Calendar content is portaled outside this wrapper. While open, the first
    // click into day/month/year blurs the trigger and would re-render mid-click
    // if we pad/emit here — eating the selection until a second click.
    if (open) return;

    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;

    padAndEmitParts();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    // Blur padding is skipped while open; normalize MM/DD when the calendar closes.
    if (!nextOpen) padAndEmitParts();
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    prevRef?: React.RefObject<HTMLInputElement | null>,
  ) {
    if (event.key !== "Backspace") return;
    if (event.currentTarget.value) return;
    prevRef?.current?.focus();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").trim();
    const slashMatch = pasted.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const isoMatch = pasted.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    let iso: string | null = null;
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      iso = displayDobToIso(`${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`);
    } else if (isoMatch) {
      iso = pasted;
    }

    if (!iso) return;

    event.preventDefault();
    const nextParts = isoDobToParts(iso);
    partsRef.current = nextParts;
    setParts(nextParts);
    emit(iso);
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return;
    const iso = dateToIsoDob(date);
    const nextParts = isoDobToParts(iso);
    partsRef.current = nextParts;
    setParts(nextParts);
    emit(iso);
    setOpen(false);
  }

  const segmentClass = cn(inputClassName, "min-w-0 tabular-nums text-center");

  return (
    <div className="flex w-full flex-nowrap items-center gap-2" onBlur={handleGroupBlur}>
      <div className="relative min-w-0 flex-[1.1]">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              tabIndex={-1}
              className="absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[#152A51]/70 transition hover:text-[#152A51]"
              aria-label="Open calendar"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="w-auto rounded-[14px] border border-[#E8EEED] bg-white p-0 shadow-lg"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <Calendar
              mode="single"
              captionLayout="dropdown"
              fromYear={minDate.getFullYear()}
              toYear={maxDate.getFullYear()}
              defaultMonth={selectedDate ?? maxDate}
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              disabled={{ after: maxDate, before: minDate }}
              className={cn(
                "onboarding-font p-3",
                "[&_.rdp-weekday]:text-[#152A51]/60",
                "[&_.rdp-caption_label]:text-[#152A51]",
                "[&_.rdp-dropdown]:bg-[#E8EEED] [&_.rdp-dropdown]:text-[#152A51]",
                "[&_button[data-selected-single=true]]:bg-[#152A51] [&_button[data-selected-single=true]]:text-white",
                "[&_button[data-selected-single=true]]:hover:bg-[#152A51] [&_button[data-selected-single=true]]:hover:text-white",
                "[&_.rdp-today]:bg-[#E8EEED] [&_.rdp-today]:text-[#152A51]",
                "[&_button]:text-[#152A51] [&_button:hover]:bg-[#E8EEED]",
              )}
            />
            {selectedDate ? (
              <div className="border-t border-[#E8EEED] px-3 py-2 text-center text-xs text-[#152A51]/70">
                {isoDobToDisplay(dateToIsoDob(selectedDate))}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        <input
          ref={monthRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM"
          maxLength={2}
          value={parts.month}
          onChange={(event) => handleSegmentChange("month", event.target.value, 2)}
          onKeyDown={(event) => handleKeyDown(event)}
          onPaste={handlePaste}
          className={cn(segmentClass, "w-full px-10")}
          aria-label="Birth month"
        />
      </div>

      <input
        ref={dayRef}
        id={`${id}-day`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD"
        maxLength={2}
        value={parts.day}
        onChange={(event) => handleSegmentChange("day", event.target.value, 2)}
        onKeyDown={(event) => handleKeyDown(event, monthRef)}
        onPaste={handlePaste}
        className={cn(segmentClass, "min-w-0 flex-1")}
        aria-label="Birth day"
      />

      <input
        ref={yearRef}
        id={`${id}-year`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="YYYY"
        maxLength={4}
        value={parts.year}
        onChange={(event) => handleSegmentChange("year", event.target.value, 4)}
        onKeyDown={(event) => handleKeyDown(event, dayRef)}
        onPaste={handlePaste}
        className={cn(segmentClass, "min-w-0 flex-[1.35]")}
        aria-label="Birth year"
      />
    </div>
  );
}
