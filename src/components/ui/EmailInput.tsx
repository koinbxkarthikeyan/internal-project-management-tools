"use client";

import { useId, useState, type ReactNode } from "react";
import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import { emailProblem, emailSuggestions } from "@/lib/auth/emailRules";
import { Field, controlClass } from "./FormControls";
import { FieldError } from "./FieldError";
import { CheckCircleIcon } from "./icons";

type EmailInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  /** The whole address passed its check: green border, icon and check mark (never together with `invalid`). */
  valid?: boolean;
  /** An icon shown inside the field, before the text. */
  leading?: ReactNode;
  className?: string;
  /** Show the "company email address" message under the field while typing (default). A form that shows its own message turns this off. */
  showError?: boolean;
  "aria-describedby"?: string;
};

/**
 * The one email input in the app. Nothing is ever filled in for you: type the whole address, or type `name@` and pick `@koinbx.com` /
 * `@koinbazar.com` from the suggestions if you like (the browser's own suggestion list, so ignoring it costs nothing).
 */
export function EmailInput({ value, onChange, placeholder = `name@${ALLOWED_EMAIL_DOMAIN}`, required, autoFocus, invalid, valid, leading, className = "", showError = true, ...rest }: EmailInputProps) {
  const listId = useId();
  const suggestions = emailSuggestions(value);
  // Checked while typing (a partly typed address is not flagged), and fully once the field has been left.
  const [left, setLeft] = useState(false);
  const problem = showError ? emailProblem(value, left) : "";
  const problemId = `${listId}-problem`;
  return (
    <>
      <span className="relative block">
      {leading && <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-3 flex items-center transition-colors ${valid && !invalid ? "text-success" : "text-muted"}`}>{leading}</span>}
      <input
        type="text"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        list={listId}
        value={value}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={invalid || !!problem || undefined}
        data-valid={(valid && !invalid && !problem) || undefined}
        aria-describedby={[rest["aria-describedby"], problem && problemId].filter(Boolean).join(" ") || undefined}
        onChange={(e) => {
          const input = e.target;
          const typed = input.value.toLowerCase(); // typed or pasted capitals become lowercase
          onChange(typed);
          if (input.value !== typed) {
            // Keep the caret where it was when capitals were lowercased (same length, so the position is unchanged).
            const at = input.selectionStart;
            requestAnimationFrame(() => at != null && input.setSelectionRange(at, at));
          }
        }}
        onBlur={() => setLeft(true)}
        className={`${controlClass} ${leading ? "pl-10" : ""} ${valid && !invalid ? "pr-10" : ""} ${className}`}
      />
      {valid && !invalid && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-success">
          <CheckCircleIcon width={18} height={18} />
        </span>
      )}
      </span>
      {problem && <FieldError id={problemId}>{problem}</FieldError>}
      <datalist id={listId}>{suggestions.map((v) => <option key={v} value={v} />)}</datalist>
    </>
  );
}

/** Labelled email field for forms. */
export function EmailField({ label, required, ...input }: EmailInputProps & { label: string }) {
  return (
    <Field label={label} required={required}>
      <EmailInput required={required} className="h-10" {...input} />
    </Field>
  );
}
