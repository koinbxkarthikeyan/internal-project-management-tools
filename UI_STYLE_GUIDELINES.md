# UI style guidelines

The rules the Backlog Tracker's interface already follows, written down so new and changed screens match. Everything here comes from the code (`src/styles/globals.css` and the shared components); where the code and a rule disagree, the rule says so under **Known gaps**. Nothing here was checked in a browser.

Stack: Next.js (App Router), React, Tailwind CSS 4, IBM Plex Sans (`--font-sans`) and Geist Mono (`--font-mono`).

## 1. Tokens (one place: `:root` and `.dark` in globals.css)

Use the tokens, never raw hex values, in components.

| Token | Use |
| --- | --- |
| `--background`, `--surface` | Page background, cards and panels |
| `--foreground`, `--muted` | Text, secondary text |
| `--border`, `--hover`, `--row-hover` | Lines, hover fill, table row hover |
| `--accent`, `--accent-foreground`, `--accent-soft` | Primary colour, text on it, its light fill (selected tab, badge) |
| `--danger`, `--danger-text`, `--success` | Errors and destructive actions, valid state |
| `--tone-above`, `--tone-below`, `--tone-over` | Hours against the expectation (readable in both themes) |
| `--brand-from`, `--brand-to` | Gradient on the sign-in card and its button only |

Tailwind names map to them (`bg-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`, `bg-accent-soft`). Dark mode is the `.dark` class on `<html>`; write `dark:` variants only where a token does not already switch.

Rules
- Both themes must be readable; accent text is checked at 6.2:1 on white.
- No new gradients outside the sign-in screens and the greeting-name text.
- A colour that carries meaning (priority, status) is always paired with text or an icon, never colour alone.

## 2. Shape and elevation

- **Radius:** controls 8px (`rounded-lg`), cards and inputs 10px (`rounded-xl`), panels, menus and modals 12px (`rounded-2xl`), pills and counts fully round. Do not introduce other radii.
- **Elevation by role:** tooltip `--elev-tip`, menu or dropdown `--elev-menu`, modal or side panel `--elev-modal`, card `--shadow-card`. Flat cards use a border, not a shadow.
- **Cards:** a panel is `class="card p-4"` (or `p-5`): 12px radius, hairline border, surface fill. A box inside a panel is `card-inset p-3` (10px radius, faint fill). Do not write `rounded-2xl border border-border bg-surface` by hand; the classes live in the components layer, so a utility on the element (another border colour or fill) still wins. Floating layers (menus, dropdowns, modals) add their own elevation on top.
- **Borders:** 1px `border-border`. Selected/focused states use the accent.

## 3. Typography

- One family. Page title `text-2xl font-semibold tracking-tight`; section title `text-sm font-semibold`; body `text-sm`; helper text `text-xs text-muted`.
- Text on controls is `text-sm` (`text-xs` for compact buttons). Avoid going below 12px for anything a person must read.

## 4. Buttons (`.btn` set in globals.css)

`.btn` is the shape (40px high, 8px radius, 14px semibold, focus ring, disabled, busy spinner via `aria-busy="true"`); one variant sets the colours.

| Variant | Use |
| --- | --- |
| `btn-brand` | The one primary action of a screen or form (Create, Save, Sign in) |
| `btn-secondary` | Neutral or secondary (Cancel, Back) |
| `btn-outline` | Secondary action that should still read as accent |
| `btn-text` | Tertiary, inline |
| `btn-danger` | Destructive (Delete, Remove) |
| `btn-success`, `btn-warning` | Only for their status meaning |
| `btn-sm` | Compact (32px, 12px type) for toolbars and card footers |

Rules
- One primary button per view. Destructive actions are never the primary style unless the whole dialog is a delete confirmation.
- Icon-only buttons need `aria-label` and a tooltip (`title`).
- Disabled controls show why (`DisabledTip`).
- `btn-brand` alone (without `.btn`) is still used in about 35 places with hand-set heights (36, 40 and 44px on the sign-in screens); it now carries the semibold label and the focus ring itself, but new buttons should use `.btn btn-brand`.
- Prefer the `.btn` classes over hand-built `h-8 rounded-lg border …` buttons so hover, focus, busy and disabled behave the same.

## 5. Fields (`.field`)

- Every text input, select and textarea is `.field` (shared controls in `FormControls.tsx` already are; the Ticket title edit and the message edit box were hand-built and now use it too). Search boxes with an icon, the composer and similar inline boxes stay custom.
- Inputs, selects and textareas use `.field` (border, hover, focus ring). Selects with many options use `SearchableSelect`; native `<select>` only for very short lists.
- Label above, helper or error text below (`FieldError`), `--danger` on error. Validate on blur and on submit; never block typing.
- Date inputs: native date type in forms, `DayField` / `MultiDatePicker` where a range or several days are needed.
- On touch screens form text is 16px (so iOS does not zoom); this is set globally.

## 6. Layout and spacing

- Spacing scale: 4, 8, 12, 16, 24 px (`gap-1` … `gap-6`). Page sections `gap-6` from `sm` up, `gap-4` on a phone.
- Page shell: sidebar fixed from `lg` (1024px), a slide-over drawer below. Content `px-4 sm:px-6`.
- `PageHeader` is the page top. Pass `oneLine` where the title and its actions must share a row on a phone (title shortens with "…", description goes under).
- Tab rows and segmented controls stay on **one row** on a phone (smaller text and padding, scroll inside the row if still too wide); never let them wrap into a tall stack.
- `ViewToggle` (List / Board) is icon-only below 640px.

## 7. Breakpoints

Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. The phone/tablet boundary used by the boards is 768px.

| Width | Layout |
| --- | --- |
| < 640 | One column, stacked lists, icon-only secondary controls, details in dropdowns |
| 640–767 | Phone landscape / small tablet: labels return |
| 768–1023 | Tablet: side-by-side boards, sidebar is a drawer |
| ≥ 1024 | Fixed sidebar (collapsible), board plus side panel |
| ≥ 1280 | Wide: chat and details panels beside the board |

Rules
- **Tables:** a list table is `<div class="rt-box"><table class="rt …">`; mark the title cell `data-primary`, the action cell `data-actions` and every other cell `data-label="…"`. Below 56rem (measured on the box) each row becomes a card, with no extra markup. Header text is `text-xs uppercase tracking-wide text-muted`. Cards, not sideways scroll, are the phone layout. The only table that scrolls sideways on purpose is the bulk-upload sheet (a spreadsheet-style editor). Sorting buttons live in the header, which is hidden in card mode, so a sortable table adds a `Sort by` control marked `rt-only` (shown only in card mode), as `QaTaskList` does.
- No horizontal page scroll at any width. A wide table scrolls inside its own box, or uses the `rt` class (turns into cards when its box is narrow).
- Use `min-w-0` on flex children that hold text so they can shrink and truncate.
- Use `min-h-dvh`, not `min-h-screen`, for full-height screens (phone browser bars).
- Do not use a fixed pixel width on anything that can reach a 320px screen; use `min()`, `max-w-*` or `minmax()`.

## 8. Status boards (Tickets, My Task, QA Workspace)

- Five statuses in this order: To Do, In Progress, Ready for QA, Testing, Done (QA Workspace: Ready for QA, Testing, Done).
- Board view is for screens 768px and wider; a phone has no Board option and always shows the list. How many status columns are open follows the width of the board when it appears (at least 240px each; In Progress first, statuses with cards before empty ones); the rest are slim vertical bars (count on top, name written vertically) in ONE line at the right (`useStatusFold`). It is worked out once, so opening a panel or resizing never folds a status by itself. Opening a bar never folds another; the last open status cannot be folded away. An opened card widens its own column.
- Cards are one component (`TaskCard`) everywhere.
- Moving a card by drag works with a mouse; on touch the status is changed from the open ticket.

## 9. Modals, drawers, menus

- **Small confirmation or notice dialog:** native `<dialog className="modal-confirm p-5">` (28rem, centred, a little above the middle, 12px card, modal elevation, 60% backdrop). Do not rebuild these classes by hand; use `modal-confirm` (add `p-0` when the dialog lays out its own sections). Used by sign-in approval, password-change notice, Reopen, Remove hidden tasks and the QA status dialog.
- Forms use `BacklogDrawer`; big read-only views (task history) and media viewers keep their own full-size dialogs.
- Dialogs are native `<dialog>` with the shared classes: `drawer` (side panel), `compact-modal`, `nested-panel`. Width is `min(<size>, 100vw − 2rem)`; on short screens padding and field heights shrink (see the `@media (max-height)` rules).
- Header and action footer stay visible; the body scrolls. Esc and a click on the backdrop close; focus returns to the opener.
- Menus and popovers are portaled and clamped to the viewport; hover-only menus must also open on focus and click.
- Confirmation dialogs name the object and the consequence ("Delete TKT-004?"), with the destructive button on the right.

## 10. Feedback states

- **Loading:** skeletons shaped like the final content (`PageSkeleton`), not a bare spinner; buttons show `aria-busy`.
- **Empty:** `ColumnEmpty` / `EmptyState` with a short sentence and, where it makes sense, the action to fill it.
- **Error:** inline next to the field, or a `role="alert"` line in the panel; toasts for results of an action (`success`, `info`, `warning`, `danger`, `delete`).
- **Disabled:** reduced opacity plus a reason.

## 11. Motion

- Durations: 150 ms hover and focus, 180 ms menus and tabs, 200 ms cards, modals and page content, 220 ms expand/collapse, 300 ms progress. Easing `ease-in-out` (`ease-out` for entry).
- Everything respects `prefers-reduced-motion`.
- No decorative animation on data screens.

## 12. Accessibility

- Visible focus ring (`outline-2 outline-accent`) on every interactive element.
- Keyboard: every action reachable, tabs and menus use the proper roles, Esc closes layers.
- Contrast at least 4.5:1 for text in both themes.
- Touch targets should reach 44×44px on touch devices.

## Known gaps (to fix, not to copy)

- Many compact buttons are 32px high, below the 44px touch target; some are hand-built instead of `.btn btn-sm`.
- About 110 places use `text-[10px]` / `text-[11px]`; keep these to badges and counts.
- Ticket and task cards cannot be dragged by touch.
- The Messages composer above the phone keyboard has not been checked.
- Nothing in this file has been verified in a browser at the target widths (320, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1920).
