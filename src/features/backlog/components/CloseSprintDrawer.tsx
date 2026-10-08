"use client";

import type { Sprint } from "@/types/backlog";
import BacklogDrawer from "./BacklogDrawer";

type CloseSprintDrawerProps = {
  sprint: Sprint;
  /** Runs the close. Return `false` to keep the panel open (e.g. the request failed). */
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onClose: () => void;
};

/** Side panel to confirm closing (completing) the running sprint. */
export default function CloseSprintDrawer({ sprint, onConfirm, onClose }: CloseSprintDrawerProps) {
  return (
    <BacklogDrawer heading="Close sprint" submitLabel="Confirm Close Sprint" onSubmit={onConfirm} onClose={onClose} compact>
      <div role="alertdialog" aria-label="Close sprint" className="flex flex-col gap-2">
        <p className="text-sm">
          Are you sure you want to close <strong className="font-semibold">{sprint.name}</strong>?
        </p>
        <p className="text-sm text-muted">
          You can close it at any time, even before its two weeks are over. It will be marked as completed and end today, and no more time can be logged against it. All its tasks and logged hours stay in it as history; every unfinished task is copied as a new task into the next sprint, which waits as Paused until you start it. A closed sprint can&apos;t be reopened.
        </p>
      </div>
    </BacklogDrawer>
  );
}
