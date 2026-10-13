"use client";

import { useId } from "react";
import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import { completeEmail, completeWhileTyping, suggestEmail } from "@/lib/auth/emailRules";
import { Field, controlClass } from "./FormControls";

type EmailInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-describedby"?: string;
};

/**
 * The one email input in the app. Type a name and the `@koinbx.com` address is suggested; type `name@` and it is
 * completed on the spot; leaving the field completes whatever is there. The address stays editable.
 */
export function EmailInput({ value, onChange, placeholder = `name@${ALLOWED_EMAIL_DOMAIN}`, required, autoFocus, invalid, className = "", ...rest }: EmailInputProps) {
  const listId = useId();
  const suggestion = suggestEmail(value);
  return (
    <>
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
        aria-describedby={rest["aria-describedby"]}
        onChange={(e) => onChange(completeWhileTyping(value, e.target.value))}
        onBlur={() => {
          const done = completeEmail(value);
          if (done !== value) onChange(done);
        }}
        className={`${controlClass} ${className}`}
      />
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
