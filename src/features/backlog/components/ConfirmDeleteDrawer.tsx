"use client";

import type { ReactNode } from "react";
import BacklogDrawer from "./BacklogDrawer";

type ConfirmDeleteDrawerProps = {
  /** Panel heading, e.g. "Delete sprint". */
  title: string;
  /** Name of the thing being deleted, shown in bold in the message. */
  name: string;
  /** What will happen as a result (shown under the question). */
  consequence?: ReactNode;
  confirmLabel?: string;
  /** Runs the deletion. Return `false` to keep the panel open (e.g. the request failed). */
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onClose: () => void;
};

/** Side panel shared by every Delete button: a message in the body, Cancel and Confirm delete in the footer. */
export default function ConfirmDeleteDrawer({
  title,
  name,
  consequence,
  confirmLabel = "Confirm delete",
  onConfirm,
  onClose,
}: ConfirmDeleteDrawerProps) {
  return (
    <BacklogDrawer heading={title} submitLabel={confirmLabel} onSubmit={onConfirm} onClose={onClose} compact danger>
      <div role="alertdialog" aria-label={title} className="flex flex-col gap-2">
        <p className="text-sm">
          Are you sure you want to delete <strong className="font-semibold">{name}</strong>?
        </p>
        {consequence && <p className="text-sm text-muted">{consequence}</p>}
        <p className="text-sm text-muted">This can&apos;t be undone.</p>
      </div>
    </BacklogDrawer>
  );
}
