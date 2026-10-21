"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DisabledTip } from "./DisabledTip";
import { EyeIcon, EyeOffIcon } from "./icons";
import { Field, controlClass } from "./FormControls";

/** How long a revealed password stays visible. */
const REVEAL_MS = 500;

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: "current-password" | "new-password";
  invalid?: boolean;
  /** The whole password passed its check: green border and icon (never together with `invalid`). */
  valid?: boolean;
  /** Shows the value (Show / Hide still works) but it can't be changed. */
  readOnly?: boolean;
  autoFocus?: boolean;
  name?: string;
  /** Can't be used yet; `disabledReason` explains why (tooltip on hover and keyboard focus). */
  disabled?: boolean;
  disabledReason?: string;
  /** An icon shown inside the field, before the text. */
  leading?: ReactNode;
  /** Id of the element that describes this field (e.g. its error message). */
  "aria-describedby"?: string;
  /** Height / extra classes for the input (e.g. "h-11" on the login screen). */
  inputClassName?: string;
};

/** Password input with a Show / Hide button; a shown password hides itself after 0.5 seconds. The value is never read back from the server. */
export function PasswordField({ label, value, onChange, placeholder, required, autoComplete = "new-password", invalid, valid, readOnly, autoFocus, name, disabled, disabledReason, leading, inputClassName = "h-10", ...rest }: PasswordFieldProps) {
  const [shownState, setShown] = useState(false);
  const shown = shownState && !disabled; // a disabled field never shows its value
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Switching the input type resets its cursor in some browsers: put the cursor / selection back where it was.
  function toggle() {
    const el = input.current;
    const start = el?.selectionStart ?? null;
    const end = el?.selectionEnd ?? null;
    clearTimeout(timer.current);
    // Showing lasts REVEAL_MS and then hides itself; clicking while shown hides it at once.
    if (shown) setShown(false);
    else {
      setShown(true);
      timer.current = setTimeout(() => setShown(false), REVEAL_MS);
    }
    if (el && start !== null && end !== null) requestAnimationFrame(() => el.setSelectionRange(start, end));
  }
  return (
    <Field label={label} required={required}>
      <DisabledTip reason={disabled && disabledReason}>
      <span className="relative block">
        {leading && <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-3 flex items-center transition-colors ${valid && !invalid ? "text-success" : "text-muted"}`}>{leading}</span>}
        <input
          ref={input}
          type={shown ? "text" : "password"}
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          disabled={disabled}
          aria-describedby={rest["aria-describedby"]}
          autoFocus={autoFocus}
          name={name}
          aria-readonly={readOnly || undefined}
          aria-invalid={invalid || undefined}
          data-valid={(valid && !invalid) || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} ${inputClassName} ${leading ? "pl-10" : ""} pr-10 ${invalid ? "border-red-500" : ""} ${readOnly ? "cursor-not-allowed opacity-70" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
        />
        <button
          type="button"
          disabled={disabled}
          // Pressing it with the mouse leaves the typing position where it was (the field keeps focus and its cursor).
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggle}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-1 my-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        >
          {shown ? <EyeIcon width={16} height={16} /> : <EyeOffIcon width={16} height={16} />}
        </button>
      </span>
      </DisabledTip>
    </Field>
  );
}
