"use client";

import { visibleControl } from "@/lib/formValidation";
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DisabledTip } from "@/components/ui/DisabledTip";
import { AlertCircleIcon, EditIcon, EyeIcon, ListIcon, PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import ExpandToggle from "@/components/ui/ExpandToggle";
import { NESTED_WIDTH, NearTriggerContext, openedByKey, placeNear, useContentCentre, useNearButton, useNestedDock } from "../nestedDock";
import { checkRequiredFields, clearFilled } from "@/lib/formValidation";

type BacklogDrawerProps = {
  /** Left side of the header. */
  heading: ReactNode;
  submitLabel: string;
  /** Return `false` to keep the panel open (e.g. validation failed). */
  onSubmit: () => void | boolean | Promise<void | boolean>;
  /** Narrow panel without the Expand toggle, for short forms. */
  compact?: boolean;
  /** Styles the submit button as a destructive action (used by delete confirmations). */
  danger?: boolean;
  /** One line under the title saying what the form is for. */
  subtitle?: string;
  /** Creating, editing, … : shown beside the title (worked out from the title when left out). */
  mode?: "Create" | "Edit" | "View" | "Confirm";
  /** Details only: the footer has just a Close button (no submit). */
  viewOnly?: boolean;
  /** A small form in the exact middle of the screen, not the middle of the right half (the keyboard shortcuts list). */
  screenCentre?: boolean;
  /** Edit forms pass `false` until something differs from the saved data, which keeps the submit button disabled. */
  canSubmit?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** A second column shown beside `children` when the panel is wide enough (below that it goes under them): the panel is then wider, and each side scrolls on its own. */
  aside?: ReactNode;
  /** Shown as a card in the page (a full-page view) instead of a slide-over panel: no Expand / Close, a Back button in the footer, and the page stays after a save. */
  inline?: boolean;
  /** A large form that slides in as a full-height panel from the right instead of the centred card (Create backlog, Edit backlog). */
  side?: boolean;
};

/**
 * Centred form (native <dialog>) shared by the Create and Edit forms, over a blurred page. The sizes are standard: a large form (many fields, a details view) is a tall, wide
 * card (and can be expanded to nearly the whole window); a small one (`compact`: a name, a few fields, a confirmation) is a card of the height its content needs, 23rem wide, centred across and a little above the middle of the screen (never against the top edge), that
 * grows as validation messages or more content appear and scrolls only when it would pass the screen.
 */
export default function BacklogDrawer({ heading, subtitle, mode: modeProp, submitLabel, onSubmit, onClose, compact = false, danger = false, viewOnly = false, screenCentre: centred = false, canSubmit = true, children, aside, inline = false, side = false }: BacklogDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  // A small form opened over another form (Add Owner / Add Team Member inside a backlog form) sits in the middle of that form; only that form is blurred behind it.
  const dock = useNestedDock(compact && !inline);
  // A small form opens in the middle of the right half of the window, near the top.
  // A small form opened with a shortcut key: in the middle of the screen (a click on the button keeps the usual place). Full-size forms stay a side panel.
  const [byKey] = useState(openedByKey);
  const keyCentred = byKey && compact;
  const screenCentre = centred || keyCentred;
  const nearWanted = useContext(NearTriggerContext) && !keyCentred;
  const near = useNearButton(compact && !inline && !dock && nearWanted);
  const centre = useContentCentre(compact && !inline && !dock && !near && !screenCentre);
  // Next to the field it opened from: below it when the whole form fits, else above it (worked out once the form's height is known).
  const [nearTop, setNearTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (near && ref.current) setNearTop(placeNear(near, ref.current.offsetHeight));
  }, [near]);
  // Dragging a small form by its header: where it has been moved to (nothing until it is dragged; a form opens in its default place each time).
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; w: number; h: number } | null>(null);
  // Creating, editing, viewing or confirming: said beside the title (worked out from the title when it is plain text).
  const mode = modeProp ?? (viewOnly ? "View" : danger ? "Confirm" : typeof heading === "string" ? (/^(create|add|plan|new)\b/i.test(heading) ? "Create" : /^(edit|rename)\b/i.test(heading) ? "Edit" : undefined) : undefined);
  const toast = useToast();

  // Plays the slide-out, then closes the native dialog (which triggers onClose / unmount).
  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => ref.current?.close(), 200);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!inline && dialog && !dialog.open) dialog.showModal();
    // A Create form opens ready to type in: the first mandatory field (any kind) takes the focus, else the first field; the browser would otherwise put it on the header's Expand /
    // Close. An Edit form only opens, the focus resting on the form itself, so nothing is changed until a field is clicked.
    if (!inline && mode === "Edit") dialog?.focus({ preventScroll: true });
    else if (!inline && viewOnly) {
      // A view-only form with a search box (data-autofocus) puts the cursor there, after what was already typed.
      const box = dialog?.querySelector<HTMLInputElement>("[data-autofocus]");
      box?.focus();
      box?.setSelectionRange(box.value.length, box.value.length);
    } else if (!inline) {
      const body = dialog?.querySelector("[data-drawer-body]");
      const usable = ":not([type=hidden], [readonly], [disabled], [tabindex='-1'])";
      const required = body?.querySelector<HTMLInputElement>(`:is(input, textarea, select)[required]:not([type=hidden], [disabled])`);
      const field = (required && visibleControl(required)) ?? body?.querySelector<HTMLElement>(`:is(input, textarea, select)${usable}`);
      field?.focus({ preventScroll: true });
    }
    // The form opens once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, viewOnly]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // A panel opened from inside another panel's form (e.g. Add Owner in a backlog form) must not submit or close its parent.
    e.stopPropagation();
    if (saving) return;
    // Required fields first: if any is empty the panel stays open and says which ones.
    if (!viewOnly && !checkRequiredFields(e.currentTarget as HTMLFormElement, toast.show)) return;
    setSaving(true);
    const result = await onSubmit();
    setSaving(false);
    if (result === false) return;
    if (!inline) requestClose();
  }

  // A small form (not the large expanded ones, not a page) is moved by dragging its header, with a mouse or a finger; the buttons and fields in the header are not handles.
  const movable = compact && !inline;
  function startDrag(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input, select, textarea, [role=button]")) return;
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top, w: box.width, h: box.height };
    setPos({ left: box.left, top: box.top, width: box.width });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveDrag(e: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const edge = 8;
    // Kept inside the visible screen, so the header can always be reached again.
    setPos({ width: d.w, left: Math.min(Math.max(edge, e.clientX - d.dx), Math.max(edge, window.innerWidth - d.w - edge)), top: Math.min(Math.max(edge, e.clientY - d.dy), Math.max(edge, window.innerHeight - d.h - edge)) });
  }
  function endDrag(e: React.PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const form = (
    <form
      noValidate
      onSubmit={handleSubmit}
      // A field that was marked missing loses its red mark once it has a value.
      onInput={(e) => clearFilled(e.currentTarget)}
      onClickCapture={(e) => {
        const form = e.currentTarget;
        requestAnimationFrame(() => clearFilled(form));
      }}
      className={inline ? "flex flex-col" : compact ? "flex max-h-[calc(100dvh-2rem)] flex-col" : "flex h-full flex-col"}
    >
      <header
        className={`flex items-start gap-3 border-b border-border ${compact ? "px-5 py-3.5" : "px-6 py-4"} ${movable ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""}`}
        onPointerDown={movable ? startDrag : undefined}
        onPointerMove={movable ? moveDrag : undefined}
        onPointerUp={movable ? endDrag : undefined}
        onPointerCancel={movable ? endDrag : undefined}
      >
        <span aria-hidden="true" className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${danger ? "bg-red-500/10 text-red-600 dark:text-red-300" : "bg-accent-soft text-accent"}`}>
          {mode === "Create" ? <PlusIcon width={16} height={16} /> : mode === "Edit" ? <EditIcon width={16} height={16} /> : mode === "View" ? <EyeIcon width={16} height={16} /> : danger ? <AlertCircleIcon width={16} height={16} /> : <ListIcon width={16} height={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <div className="min-w-0 text-base font-semibold leading-snug">{heading}</div>
            {mode && <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-muted">{mode}</span>}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {!inline && (
          <div className="flex items-center gap-1">
            <ExpandToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} className={compact ? "hidden" : "hidden sm:flex"} />
            <button
              type="button"
              onClick={requestClose}
              className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
            >
              Close
            </button>
          </div>
        )}
      </header>

      {aside ? (
        // Wide: the details on the left (55%) and the aside on the right (45%) with a hairline between, each scrolling by itself. Narrow: one scroll, the aside under the details.
        <div className="@container flex min-h-0 flex-1 flex-col overflow-y-auto @3xl:overflow-hidden">
          <div className="flex flex-col @3xl:min-h-0 @3xl:flex-1 @3xl:flex-row">
            <div data-drawer-body className="flex flex-col gap-4 px-6 py-5 @3xl:basis-[55%] @3xl:overflow-y-auto">{children}</div>
            <div className="flex flex-col border-t border-border @3xl:min-h-0 @3xl:basis-[45%] @3xl:border-l @3xl:border-t-0">{aside}</div>
          </div>
        </div>
      ) : (
        <div data-drawer-body className={`flex flex-1 flex-col ${compact ? "gap-3 px-5 py-4" : "gap-4 px-6 py-5"} ${inline ? "" : "overflow-y-auto"}`}>{children}</div>
      )}

      <footer className={`flex justify-end gap-2 border-t border-border py-3 ${compact ? "px-5" : "px-6"}`}>
        <button
          type="button"
          onClick={inline ? onClose : requestClose}
          className="btn btn-secondary"
        >
          {inline ? "Back" : viewOnly ? "Close" : "Cancel"}
        </button>
        {!viewOnly && (
          <DisabledTip reason={!saving && !canSubmit && "No changes to save."} className="inline-block">
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className={`btn ${danger ? "btn-danger" : "btn-brand"}`}
              aria-busy={saving}
            >
              {saving ? "Saving…" : submitLabel}
            </button>
          </DisabledTip>
        )}
      </footer>
    </form>
  );

  if (inline) return <div className="rounded-2xl border border-border bg-surface text-foreground">{form}</div>;

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      // React passes a dialog's "close" and "cancel" events up to the panel it is nested in (Add Owner inside a backlog
      // form), so each panel only reacts to its own.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        // Escape: animate out instead of closing instantly.
        e.preventDefault();
        if (e.target !== e.currentTarget) return;
        // An expanded form first returns to its normal size; Esc again closes it.
        if (expanded) setExpanded(false);
        else requestClose();
      }}
      data-closing={closing || undefined}
      onClick={(e) => e.target === ref.current && requestClose()}
      // Ctrl+F (⌘F) expands every form that has an Expand button (instead of the browser's find bar); once expanded, only Esc shrinks it.
      onKeyDown={(e) => {
        if (inline || compact || expanded || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f") return;
        e.preventDefault();
        e.stopPropagation();
        setExpanded(true);
      }}
      aria-label="Backlog item"
      style={screenCentre && !pos ? { left: "50%", top: "50%", right: "auto", bottom: "auto", margin: 0, translate: "-50% -50%" } : pos ? { left: pos.left, top: pos.top, width: pos.width, right: "auto", bottom: "auto", margin: 0, translate: "none", height: "fit-content" } : dock ? { left: dock.left, top: dock.top, right: "auto", bottom: "auto", margin: 0, translate: "0 -50%", width: NESTED_WIDTH, maxHeight: dock.height } : near ? { left: near.left, top: nearTop ?? near.buttonBottom + 8, right: "auto", bottom: "auto", margin: 0, translate: "none", height: "fit-content" } : centre ? { left: centre, right: "auto", top: "10dvh", bottom: "auto", margin: 0, translate: "-50% 0" } : undefined}
      className={dock ? `nested-panel nested-center fixed h-fit overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-modal backdrop:bg-transparent` : `fixed border border-border bg-surface p-0 text-foreground shadow-modal backdrop:bg-black/50 ${side && !compact && !expanded ? `drawer inset-y-0 right-0 m-0 ml-auto h-dvh max-h-dvh w-full rounded-none border-y-0 border-r-0 ${expanded ? "max-w-none" : aside ? "max-w-5xl" : "max-w-3xl"}` : `compact-modal inset-0 m-auto overflow-hidden rounded-2xl ${compact ? "inset-y-auto bottom-[10dvh] top-0 h-fit max-h-[calc(90dvh-2rem)] w-[min(23rem,calc(100vw-2rem))]" : `h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] ${expanded ? "max-w-6xl" : aside ? "max-w-5xl" : "max-w-3xl"}`}`}`}
    >
      {form}
    </dialog>
  );
}
