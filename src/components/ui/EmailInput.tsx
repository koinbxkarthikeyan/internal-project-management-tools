"use client";

import { useId, type ReactNode } from "react";
import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import { completeEmail, completeWhileTyping, suggestEmail } from "@/lib/auth/emailRules";
import { Field, controlClass } from "./FormControls";
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
  "aria-describedby"?: string;
};

/**
 * The one email input in the app. Type a name and the `@koinbx.com` address is suggested; type `name@` and it is
 * completed on the spot; leaving the field completes whatever is there. The address stays editable.
 */
export function EmailInput({ value, onChange, placeholder = `name@${ALLOWED_EMAIL_DOMAIN}`, required, autoFocus, invalid, valid, leading, className = "", ...rest }: EmailInputProps) {
  const listId = useId();
  const suggestion = suggestEmail(value);
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
        aria-invalid={invalid || undefined}
        data-valid={(valid && !invalid) || undefined}
        aria-describedby={rest["aria-describedby"]}
        onChange={(e) => {
          const input = e.target;
          const typed = input.value.toLowerCase(); // typed or pasted capitals become lowercase
          const next = completeWhileTyping(value, typed);
          onChange(next);
          // The domain was added after a typed "@": select it, so carrying on typing (e.g. the rest of "…@koinbx.com") replaces it.
          if (next !== typed) requestAnimationFrame(() => input.setSelectionRange(typed.length, next.length));
          else if (input.value !== typed) {
            // Keep the caret where it was when capitals were lowercased (same length, so the position is unchanged).
            const at = input.selectionStart;
            requestAnimationFrame(() => at != null && input.setSelectionRange(at, at));
          }
        }}
        onBlur={() => {
          const done = completeEmail(value).toLowerCase();
          if (done !== value) onChange(done);
        }}
        className={`${controlClass} ${leading ? "pl-10" : ""} ${valid && !invalid ? "pr-10" : ""} ${className}`}
      />
      {valid && !invalid && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-success">
          <CheckCircleIcon width={18} height={18} />
        </span>
      )}
      </span>
      <datalist id={listId}>{suggestion && <option value={suggestion} />}</datalist>
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
