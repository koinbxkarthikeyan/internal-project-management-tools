"use client";

import { useId, useState, type ReactNode } from "react";

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

function FieldOrNot({ label, required, children }: { label?: string; required?: boolean; children: ReactNode }) {
  return label ? (
    <Field label={label} required={required}>
      {children}
    </Field>
  ) : (
    <>{children}</>
  );
}

type Choice = { value: string; label: string; group?: string; create?: boolean };

/**
 * A dropdown you can search: click it (or tab into it) and type to filter, use the arrow keys or the mouse to pick.
 * Same look as the Assignees list. Every SelectField in the app is one of these.
 */
export function SelectField(props: SelectFieldProps & CreateProps) {
  return <SearchableSelect {...props} />;
}

type CreateProps = {
  /**
   * Lets a name that isn't in the list be added: typing one shows a `+ Add "name"` row, and only choosing that row calls this
   * (typing alone never creates anything). The caller saves it and then selects it.
   */
  onCreate?: (name: string) => void | Promise<void>;
  /** An extra row always shown at the end of the list (e.g. "+ Add Team Member"); choosing it calls `onSelect`. */
  action?: { label: string; onSelect: () => void };
};

type SearchableSelectProps = Omit<SelectFieldProps, "label"> & CreateProps & {
  /** Visible label; without one, give `ariaLabel` (used by the toolbar filters). */
  label?: string;
  ariaLabel?: string;
  /** Classes for the text input (size / text size). */
  inputClassName?: string;
};

export function SearchableSelect({ label, ariaLabel, inputClassName = "h-10", value, onChange, options, groups, placeholder, required, disabled, onCreate, action, className = "" }: SearchableSelectProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const choices: Choice[] = [
    ...(groups ?? []).flatMap((g) => g.options.map((o) => ({ value: o, label: o, group: g.label }))),
    ...options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
  ];
  const selected = choices.find((c) => c.value === value);
  const q = query.trim().toLowerCase();
  const matches = q ? choices.filter((c) => c.label.toLowerCase().includes(q)) : choices;
  // With a placeholder and no "required", the empty choice clears the field.
  const canClear = placeholder !== undefined && !required && !q;
  const typed = query.replace(/\s+/g, " ").trim();
  // "Add" is offered only for a name that isn't there yet (case and spacing ignored).
  const canAdd = !!onCreate && !!typed && !choices.some((c) => c.label.replace(/\s+/g, " ").trim().toLowerCase() === typed.toLowerCase());
  const rows: Choice[] = [...(canClear ? [{ value: "", label: placeholder }] : []), ...matches, ...(canAdd ? [{ value: typed, label: `+ Add "${typed}"`, create: true }] : []), ...(action ? [{ value: "__action__", label: action.label, create: true }] : [])];

  function close() {
    setOpen(false);
    setQuery("");
  }
  function pick(c: Choice) {
    close();
    if (c.value === "__action__") action?.onSelect();
    else if (c.create) void onCreate?.(c.value);
    else onChange(c.value);
  }

  return (
    <div
      className={`relative min-w-0 ${className}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
    >
      <FieldOrNot label={label} required={required}>
        <span className="relative block">
          <input
            role="combobox"
            aria-label={label ? undefined : ariaLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            value={open ? query : (selected?.label ?? "")}
            placeholder={placeholder ?? "Select"}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(e) => (setQuery(e.target.value), setOpen(true), setActive(0))}
            onKeyDown={(e) => {
              if (e.key === "Escape" && open) return e.preventDefault(), e.stopPropagation(), close();
              if (e.key === "ArrowDown") return e.preventDefault(), setOpen(true), setActive((i) => Math.min(i + 1, rows.length - 1));
              if (e.key === "ArrowUp") return e.preventDefault(), setActive((i) => Math.max(i - 1, 0));
              if (e.key === "Enter" && open) {
                e.preventDefault();
                if (rows[active]) pick(rows[active]);
              }
            }}
            className={`${controlClass} ${inputClassName} pr-8 disabled:cursor-not-allowed disabled:opacity-70`}
          />
          <svg
            viewBox="0 0 20 20"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          >
            <path d="m5 8 5 5 5-5" />
          </svg>
        </span>
      </FieldOrNot>
      {/* Lets the browser's own "required" check work for the custom control. */}
      {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 opacity-0" />}
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label ?? ariaLabel}
          className="anim-fade-up absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {rows.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches.</li>}
          {rows.map((c, i) => (
            <li key={`${c.group ?? ""}:${c.value}`} role="option" aria-selected={c.value === value}>
              {c.group && c.group !== rows[i - 1]?.group && <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">{c.group}</p>}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent ${
                  i === active ? "bg-hover" : ""
                } ${c.create ? "font-medium text-accent" : c.value === value ? "font-medium text-accent" : c.value === "" ? "text-muted" : ""}`}
              >
                <span className="min-w-0 truncate">{c.label}</span>
                {!c.create && c.value === value && c.value !== "" && <span className="shrink-0 text-xs">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  /** Called when the field is left or Enter is pressed (e.g. to save the typed or picked value). */
  onCommit?: () => void;
};

/** Searchable dropdown that also accepts a new value: pick a suggestion or type one that isn't listed (e.g. a new Team). */
export function ComboField({ label, value, onChange, suggestions, placeholder, required, onCommit }: ComboFieldProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = value.trim().toLowerCase();
  const matches = q ? suggestions.filter((o) => o.toLowerCase().includes(q)) : suggestions;
  const isNew = !!q && !suggestions.some((o) => o.toLowerCase() === q);
  const finish = () => {
    setOpen(false);
    onCommit?.();
  };

  return (
    <div
      className="relative min-w-0"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        if (open) finish();
        setOpen(false);
      }}
    >
      <Field label={label} required={required}>
        <span className="relative block">
          <input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            autoComplete="off"
            value={value}
            required={required}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(e) => (onChange(e.target.value), setOpen(true), setActive(0))}
            onKeyDown={(e) => {
              if (e.key === "Escape" && open) return e.preventDefault(), e.stopPropagation(), setOpen(false);
              if (e.key === "ArrowDown") return e.preventDefault(), setOpen(true), setActive((i) => Math.min(i + 1, matches.length - 1));
              if (e.key === "ArrowUp") return e.preventDefault(), setActive((i) => Math.max(i - 1, 0));
              if (e.key === "Enter") {
                e.preventDefault();
                if (open && matches[active] && !(isNew && matches.length === 0)) onChange(matches[active]);
                finish();
              }
            }}
            className={`${controlClass} h-10 pr-8`}
          />
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            <path d="m5 8 5 5 5-5" />
          </svg>
        </span>
      </Field>
      {open && (matches.length > 0 || isNew) && (
        <ul id={listId} role="listbox" aria-label={label} className="anim-fade-up absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {matches.map((o, i) => (
            <li key={o} role="option" aria-selected={o.toLowerCase() === q}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => (onChange(o), setOpen(false), onCommit?.())}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent ${i === active ? "bg-hover" : ""} ${o.toLowerCase() === q ? "font-medium text-accent" : ""}`}
              >
                <span className="min-w-0 truncate">{o}</span>
                {o.toLowerCase() === q && <span className="shrink-0 text-xs">✓</span>}
              </button>
            </li>
          ))}
          {isNew && <li className="px-3 py-2 text-xs text-muted">Press Enter to use &ldquo;{value.trim()}&rdquo; as a new value.</li>}
        </ul>
      )}
    </div>
  );
}
