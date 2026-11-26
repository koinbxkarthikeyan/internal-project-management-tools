"use client";

import { useEffect, useId } from "react";
import { create } from "zustand";

/** Which Create Ticket form is open (its owner's id), if any. Only one can be open at a time, wherever it was opened from. */
const useOpenForm = create<{ owner: string | null }>(() => ({ owner: null }));

/**
 * The one Create Ticket form slot. Every place that can open the form (the Tickets block, the Create Ticket button on a card or row, the comments box) calls this:
 * `creating` says this place's own form is open, `blocked` says another place's is, so its Create Ticket control is disabled until that one closes.
 */
export function useTicketFormSlot() {
  const id = useId();
  const owner = useOpenForm((s) => s.owner);
  const end = () => useOpenForm.setState((s) => (s.owner === id ? { owner: null } : s));
  // A form that goes away (the page changes) gives its slot back.
  useEffect(() => () => useOpenForm.setState((s) => (s.owner === id ? { owner: null } : s)), [id]);
  return {
    creating: owner === id,
    blocked: owner !== null && owner !== id,
    begin: () => useOpenForm.setState((s) => (s.owner === null ? { owner: id } : s)),
    end,
  };
}

export const TICKET_FORM_OPEN_TIP = "Another Create Ticket form is open. Finish or close it first.";
