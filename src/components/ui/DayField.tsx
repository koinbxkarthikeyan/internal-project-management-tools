"use client";

import { useEffect, useRef, useState } from "react";
import { DisabledTip } from "./DisabledTip";
import { Field, controlClass } from "./FormControls";
import MultiDatePicker from "./MultiDatePicker";

const SHOWN = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  min?: string;
  max?: string;
  /** Days that can't be picked (leave); weekends and days outside min / max never can. */
  blocked?: ReadonlySet<string>;
};

/** One date, picked from a calendar popup in which weekends, leave and out-of-range days are greyed out (a browser date box cannot do that). */
export default function DayField({ label, value, onChange, required, disabled, disabledReason, min, max, blocked }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
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

  return (
    <Field label={label} required={required}>
      <div ref={box} className="relative">
        <DisabledTip reason={disabled && disabledReason}>
          <button type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${controlClass} h-10 text-left disabled:opacity-60`}>
            {value ? SHOWN.format(new Date(`${value}T00:00:00Z`)) : "Select a date"}
          </button>
        </DisabledTip>
        {open && (
          <div role="dialog" aria-label={label} className="absolute left-0 top-full z-30 mt-1 rounded-xl border border-border bg-surface p-1 shadow-lg">
            <MultiDatePicker
              compact
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
          </div>
        )}
      </div>
    </Field>
  );
}
