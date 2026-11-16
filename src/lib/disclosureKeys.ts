import type { KeyboardEvent } from "react";

/**
 * The keyboard rule for every arrow button that opens and closes a section (the › beside a task's Owner, a row's Tickets and comments, a Ticket summary, a sprint's tasks): with the
 * button focused, the Down arrow opens it and the Up arrow closes it. Enter and Space keep toggling it as for any button. Put the result in the button's onKeyDown.
 */
export const disclosureKeys = (open: boolean, toggle: () => void) => (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if ((e.key === "ArrowDown" && !open) || (e.key === "ArrowUp" && open)) {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }
};
