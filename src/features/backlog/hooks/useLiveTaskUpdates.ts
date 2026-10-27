"use client";

import { useEffect } from "react";
import { SOCKET_EVENTS } from "@/constants/socketEvents";
import { connectSocket, disconnectSocket, onSocketEvent, socketEnabled } from "@/lib/socketClient";
import * as backlogService from "@/services/backlogService";
import { useBacklogStore } from "@/stores/backlogStore";
import type { StatusChangedEvent } from "@/types/socket";

const SEEN_LIMIT = 200;

/**
 * Keeps the shared tasks current while the app is open: connects the live-update socket once the data is loaded, and when the server
 * announces a saved status change, reads that one task again (so status and activity are the server's) and swaps it into the store.
 * One listener per mount; a repeated delivery of the same event, and the echo of this browser's own change, are ignored.
 * Does nothing when no socket URL is configured.
 */
export function useLiveTaskUpdates(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !socketEnabled) return;
    connectSocket();
    const seen = new Set<string>();
    const off = onSocketEvent<StatusChangedEvent>(SOCKET_EVENTS.statusChanged, (event) => {
      if (!event || typeof event.itemId !== "number" || backlogService.isOwnRequest(event.requestId)) return;
      const key = `${event.itemId}:${event.changedAt ?? event.status}`;
      if (seen.has(key)) return;
      if (seen.size >= SEEN_LIMIT) seen.clear();
      seen.add(key);
      const { items, setItems } = useBacklogStore.getState();
      const known = items.find((i) => i.apiId === event.itemId);
      if (!known) return; // not one of the tasks this person has loaded
      backlogService.getItem(known.id).then(
        (saved) => setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i))),
        () => seen.delete(key), // the re-read failed: a later delivery may try again
      );
    });
    return () => {
      off();
      disconnectSocket();
    };
  }, [enabled]);
}
