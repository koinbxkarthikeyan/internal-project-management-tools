import { useId, type ReactNode } from "react";

export const controlClass =
  "w-full rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent";

type FieldProps = {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({ label, required, className = "", children }: FieldProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted ${className}`}>
      <span>
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-500">
            {" "}
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

type Option = string | { value: string; label: string };

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  /** Labelled groups (native <optgroup>) shown before `options`. */
  groups?: readonly { label: string; options: readonly string[] }[];
  placeholder?: string;
  required?: boolean;
  /** Shows the value but can't be changed. */
  disabled?: boolean;
  className?: string;
};

export function SelectField({ label, value, onChange, options, groups, placeholder, required, disabled, className }: SelectFieldProps) {
  return (
    <Field label={label} required={required} className={className}>
      <select
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} h-10 disabled:cursor-not-allowed disabled:opacity-70 ${value === "" ? "text-muted" : "text-foreground"}`}
      >
        {placeholder !== undefined && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o} value={o} className="text-foreground">
                {o}
              </option>
            ))}
          </optgroup>
        ))}
        {options.map((o) => {
          const { value: v, label: l } = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={v} value={v} className="text-foreground">
              {l}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "date" | "number" | "password";
  /** Shows the value but can't be changed (e.g. a date worked out from another field). */
  disabled?: boolean;
  min?: string;
  max?: string;
  step?: string;
  className?: string;
};

export function TextField({ label, value, onChange, placeholder, required, type = "text", disabled, min, max, step, className }: TextFieldProps) {
  return (
    <Field label={label} required={required} className={className}>
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} h-10 disabled:opacity-60`}
      />
    </Field>
  );
}

type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  invalid?: boolean;
};

export function TextAreaField({ label, value, onChange, placeholder, required, rows = 3, invalid }: TextAreaFieldProps) {
  return (
    <Field label={label} required={required}>
      <textarea
        value={value}
        rows={rows}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} resize-y py-2 ${invalid ? "border-red-500 bg-red-500/10" : ""}`}
      />
    </Field>
  );
}

type ComboFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Suggestions shown as the user types; any other text is allowed too. */
  suggestions: readonly string[];
  placeholder?: string;
  required?: boolean;
};

/** Text input with suggestions (native datalist): pick an existing value or type a new one. */
export function ComboField({ label, value, onChange, suggestions, placeholder, required }: ComboFieldProps) {
  const listId = useId();
  return (
    <Field label={label} required={required}>
      <input
        list={listId}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} h-10`}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  );
}
