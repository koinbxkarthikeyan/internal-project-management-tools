"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as chat from "@/services/messageService";

const REPEAT_MS = 2500; // while someone keeps typing, they are reported again this often (not on every key)
const IDLE_MS = 2000; // no key for this long: they have stopped
const LOOK_MS = 1500; // how often a conversation on screen asks who is typing

/**
 * The sending side: `report(true)` whenever the person's message box has text (it tells the server at most every 2.5 s, and "stopped" after 2 s without a key), `report(false)`
 * when it is empty or the message was sent. Leaving the conversation (another one is opened, the panel closes, the page goes) also says "stopped".
 */
export function useTypingSender(convKey: string) {
  const on = useRef(false);
  const last = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stop = useCallback(() => {
    clearTimeout(idle.current);
    if (!on.current) return;
    on.current = false;
    void chat.setTyping(convKey, false).catch(() => undefined);
  }, [convKey]);

  useEffect(() => stop, [stop]);

  return useCallback(
    (typing: boolean) => {
      if (!typing) return stop();
      clearTimeout(idle.current);
      idle.current = setTimeout(stop, IDLE_MS);
      const now = Date.now();
      if (on.current && now - last.current < REPEAT_MS) return;
      on.current = true;
      last.current = now;
      void chat.setTyping(convKey, true).catch(() => undefined);
    },
    [convKey, stop],
  );
}

/** The receiving side: the names of the other people typing in this conversation now (nobody for a conversation that is not the one asked about). Asks while the page is visible. */
export function useTypingNames(convKey: string): string[] {
  const [seen, setSeen] = useState<{ key: string; names: string[] }>({ key: convKey, names: [] });
  useEffect(() => {
    let live = true;
    const look = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const all = await chat.getTyping([convKey]);
        if (live) setSeen({ key: convKey, names: all[convKey] ?? [] });
      } catch {
        // the next look tries again
      }
    };
    const first = setTimeout(() => void look(), 0);
    const timer = setInterval(() => void look(), LOOK_MS);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [convKey]);
  return seen.key === convKey ? seen.names : [];
}
