"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DisabledTip } from "./DisabledTip";
import { Field, controlClass } from "./FormControls";
import MultiDatePicker from "./MultiDatePicker";

const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Props = {
  /** The field's label. Leave it out (with `bare`) for a date box that sits inside another control, such as the from / to filter. */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  min?: string;
  max?: string;
  /** Days that can't be picked (leave); days outside min / max never can. */
  blocked?: ReadonlySet<string>;
  /** Saturdays and Sundays can be picked (work and leave days leave them off). */
  allowWeekends?: boolean;
  /** No label or wrapper, a plain trigger (give it `ariaLabel`). */
  bare?: boolean;
  ariaLabel?: string;
  /** Classes for the trigger button in `bare` mode. */
  className?: string;
  placeholder?: string;
  /** Classes for the field's wrapper (its place in a grid). */
  fieldClassName?: string;
};

/**
 * One date, picked from the application's calendar popup (the same look everywhere): month arrows, today marked, days outside the range greyed out, "Clear" for an optional date
 * and "Done". It opens below the field, or above it / to the left when there is no room. A required field keeps a hidden twin input, so the form's required check sees it.
 */
export default function DayField({ label, value, onChange, required, disabled, disabledReason, min, max, blocked, allowWeekends = false, bare = false, ariaLabel, className = "", placeholder = "Select a date", fieldClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ up: false, right: false });
  const box = useRef<HTMLDivElement>(null);
  const popId = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function toggle() {
    if (!open && box.current) {
      const r = box.current.getBoundingClientRect();
      setPlace({ up: window.innerHeight - r.bottom < 420 && r.top >= 420, right: r.left + 280 > window.innerWidth });
    }
    setOpen((o) => !o);
  }

  const shown = value ? (bare ? SHORT : LONG).format(new Date(`${value}T00:00:00Z`)) : "";
  const trigger = (
    <button
      type="button"
      role="combobox"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={popId}
      aria-label={ariaLabel}
      onClick={toggle}
      className={bare ? `${className} truncate text-left ${shown ? "" : "text-muted"}` : `${controlClass} h-10 text-left disabled:opacity-60 ${shown ? "" : "text-muted"}`}
    >
      {shown || placeholder}
    </button>
  );

  const body = (
    <div ref={box} className={bare ? "relative min-w-0 flex-1 sm:flex-none" : "relative"}>
      {bare ? trigger : <DisabledTip reason={disabled && disabledReason}>{trigger}</DisabledTip>}
      {/* The twin the form's required check reads (the visible trigger is a button). */}
      <input aria-hidden="true" tabIndex={-1} readOnly required={required} value={value} className="pointer-events-none absolute inset-0 -z-10 opacity-0" />
      {open && (
        <div
          id={popId}
          ref={(el) => el?.scrollIntoView({ block: "nearest" })}
          role="dialog"
          aria-label={label ?? ariaLabel}
          className={`absolute z-50 w-max rounded-xl border border-border bg-surface p-2 shadow-menu ${place.up ? "bottom-full mb-1" : "top-full mt-1"} ${place.right ? "right-0" : "left-0"}`}
        >
          <MultiDatePicker
            compact
            allowWeekends={allowWeekends}
            value={value ? [value] : []}
            min={min}
            max={max}
            taken={blocked}
            onChange={(v) => {
              const picked = v.find((d) => d !== value);
              if (!picked) return;
              onChange(picked);
              setOpen(false);
            }}
          />
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border px-1 pt-2">
            <span className="text-xs text-muted">{value ? shown : "Click a day to select"}</span>
            <span className="flex gap-1">
              {!required && value && (
                <button type="button" onClick={() => (onChange(""), setOpen(false))} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-hover">Clear</button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1 text-xs font-medium text-accent hover:bg-hover">Done</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return bare ? body : <Field label={label ?? ""} required={required} className={fieldClassName}>{body}</Field>;
}
