type Show = (message: string, tone?: "success" | "info" | "danger", durationMs?: number) => void;

const MARK = "data-missing";

/** The visible control for a required field: for the custom dropdowns the real input is a hidden twin, the combobox is shown. */
function visibleControl(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): HTMLElement {
  if (el.getAttribute("aria-hidden") === "true") {
    const combo = el.parentElement?.querySelector<HTMLElement>('[role="combobox"]');
    if (combo) return combo;
  }
  return el;
}

/** "Name *" -> "Name": the label text of the field a control belongs to. */
function labelOf(el: HTMLElement): string {
  const wrap = el.closest("label") ?? el.parentElement?.querySelector("label");
  const text = wrap?.querySelector("span")?.textContent ?? el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? "";
  return text.replace(/\s*\*\s*$/, "").replace(/,.*$/, "").trim();
}

const isEmpty = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) =>
  el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? !el.checked : !el.value.trim();

/** Takes the red mark off the fields that have been filled in since. */
export function clearFilled(form: HTMLFormElement) {
  form.querySelectorAll<HTMLElement>(`[${MARK}]`).forEach((c) => {
    // A custom dropdown keeps its real value in a hidden twin next to its field; other controls hold their own.
    const twin = c.getAttribute("role") === "combobox" ? c.closest("div.relative")?.querySelector<HTMLInputElement>('input[aria-hidden="true"]') : null;
    const value = twin ? twin.value : (c as HTMLInputElement).value;
    if (value && value.trim()) {
      c.removeAttribute(MARK);
      c.removeAttribute("aria-invalid");
    }
  });
}

/**
 * Checks every required field of a form. If some are empty it marks them red, shows a message naming them, moves focus to the
 * first one and returns false (the form must then stay open). Optional fields are never checked. The browser's own bubble is
 * not used (forms are `noValidate`), so the message is the same everywhere.
 */
export function checkRequiredFields(form: HTMLFormElement, show: Show): boolean {
  clearFilled(form);
  const missing: { control: HTMLElement; label: string }[] = [];
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[required], select[required], textarea[required]").forEach((el) => {
    if (el.disabled || el.type === "hidden" || !isEmpty(el)) return;
    const control = visibleControl(el);
    missing.push({ control, label: labelOf(control) || labelOf(el) });
  });
  if (missing.length === 0) return true;

  for (const m of missing) {
    m.control.setAttribute(MARK, "true");
    m.control.setAttribute("aria-invalid", "true");
  }
  const names = [...new Set(missing.map((m) => m.label).filter(Boolean))];
  show(names.length ? `Please fill in all required fields: ${names.join(", ")}.` : "Please fill in all required fields.", "danger");
  const first = missing[0].control;
  first.scrollIntoView({ block: "center", behavior: "smooth" });
  first.focus({ preventScroll: true });
  return false;
}
