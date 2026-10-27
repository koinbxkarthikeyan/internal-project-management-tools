"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { OTP_LENGTH } from "@/constants/auth";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
};

/** Six single-digit boxes: types advance, Backspace goes back, pasting a code fills all of them. */
export default function OtpInput({ value, onChange, disabled, invalid }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[Math.min(Math.max(i, 0), OTP_LENGTH - 1)]?.focus();

  function setDigit(i: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    // Typing several digits at once (autofill) spreads them across the boxes.
    const next = (value.slice(0, i) + typed).slice(0, OTP_LENGTH);
    onChange(next + value.slice(next.length));
    focus(i + typed.length);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  }

  return (
    <div role="group" aria-label={`${OTP_LENGTH}-digit code`} className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={i === 0}
          maxLength={OTP_LENGTH}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.currentTarget.select()}
          className={`h-12 w-full min-w-0 rounded-xl border bg-background text-center text-lg font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 sm:h-14 ${
            invalid ? "border-red-500" : "border-border"
          }`}
        />
      ))}
    </div>
  );
}
