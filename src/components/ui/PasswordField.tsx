"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";
import { Field, controlClass } from "./FormControls";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: "current-password" | "new-password";
  invalid?: boolean;
  /** Shows the value (Show / Hide still works) but it can't be changed. */
  readOnly?: boolean;
};

/** Password input with a Show / Hide button. The value is never read back from the server. */
export function PasswordField({ label, value, onChange, placeholder, required, autoComplete = "new-password", invalid, readOnly }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} required={required}>
      <span className="relative block">
        <input
          type={shown ? "text" : "password"}
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${controlClass} h-10 pr-10 ${invalid ? "border-red-500" : ""} ${readOnly ? "cursor-not-allowed opacity-70" : ""}`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        >
          {shown ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
        </button>
      </span>
    </Field>
  );
}
