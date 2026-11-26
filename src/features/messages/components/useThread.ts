"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onExternalChange } from "@/lib/localApi";
import * as chat from "@/services/messageService";

/**
 * One conversation's messages ("task:<id>" or "dm:<person id>"): read when it opens and again whenever somebody else changes the shared data, marked read while it is on
 * screen with unread messages, and `send` adds the person's own message. `newFrom` is the first message that was unread when it opened (a "New messages" line goes above it).
 */
export function useThread(convKey: string, myId: string, unread: number, onChanged: () => void, withTickets = false, autoRead = true, reloadToken = 0) {
  const [messages, setMessages] = useState<chat.ChatMessage[] | null>(null);
  const [newFrom, setNewFrom] = useState<number | null>(null);
  const unreadAtOpen = useRef(unread);
  const opened = useRef(false);

  useEffect(() => {
    const read = async () => {
      try {
        const list = await chat.getMessages(convKey, 0, withTickets);
        setMessages(list);
        if (!opened.current) {
          opened.current = true;
          let left = unreadAtOpen.current;
          for (let i = list.length - 1; i >= 0 && left > 0; i--) if (list[i].fromId !== myId && --left === 0) setNewFrom(list[i].id);
        }
      } catch {
        // the next refresh tries again
      }
    };
    const first = setTimeout(() => void read(), 0);
    const off = onExternalChange(() => void read());
    return () => (clearTimeout(first), off());
  }, [convKey, myId, withTickets, reloadToken]);

  useEffect(() => {
    if (autoRead && unread > 0 && messages) void chat.markRead(convKey, withTickets).then(onChanged, () => undefined);
  }, [autoRead, unread, messages, convKey, withTickets, onChanged]);

  const send = useCallback(
    // `to`: another conversation of the same panel (one of the task's Tickets); the message is then shown here with it.
    async (text: string, to: string = convKey, o: chat.SendOptions = {}) => {
      const m = await chat.sendMessage(to, text, o);
      if (to !== convKey) m.taskId = Number(to.slice(5));
      setMessages((list) => (list?.some((x) => x.id === m.id) ? list : [...(list ?? []), m]));
      onChanged();
    },
    [convKey, onChanged],
  );

  // Deletes a message (a Ticket's message is in the Ticket's own conversation): for everyone it stays in the chat as "This message was deleted"; for me it only goes from this person's view.
  const remove = useCallback(
    async (m: chat.ChatMessage, scope: "everyone" | "me") => {
      await chat.deleteMessage(m.taskId != null ? `task:${m.taskId}` : convKey, m.id, scope);
      setMessages((list) => (scope === "me" ? list?.filter((x) => x.id !== m.id) : list?.map((x) => (x.id === m.id ? { ...x, text: "", deleted: true, canDelete: false } : x))) ?? list);
      onChanged();
    },
    [convKey, onChanged],
  );

  /** Changes the words of the person's own text message. */
  const edit = useCallback(
    async (m: chat.ChatMessage, text: string) => {
      const saved = await chat.editMessage(m.taskId != null ? `task:${m.taskId}` : convKey, m.id, text);
      setMessages((list) => list?.map((x) => (x.id === m.id ? { ...x, text: saved.text, edited: true } : x)) ?? list);
      onChanged();
    },
    [convKey, onChanged],
  );
  /** Gives or takes back a reaction on a message. */
  const react = useCallback(
    async (m: chat.ChatMessage, emoji: string) => {
      const reactions = await chat.reactMessage(m.taskId != null ? `task:${m.taskId}` : convKey, m.id, emoji);
      setMessages((list) => list?.map((x) => (x.id === m.id ? { ...x, reactions: Object.keys(reactions).length ? reactions : undefined } : x)) ?? list);
    },
    [convKey],
  );
  return { messages, newFrom, send, remove, edit, react };
}
