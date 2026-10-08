"use client";

import { useToast } from "@/components/ui/Toast";
import { useBacklog } from "../context/BacklogContext";
import OwnerFormDrawer from "./OwnerFormDrawer";

type CreateOwnerDrawerProps = {
  onClose: () => void;
  heading?: string;
  submitLabel?: string;
  requireRole?: boolean;
  /** Shows the Role / Position field (default true). */
  showRole?: boolean;
  /** Called with the saved name, e.g. to select the new person in a dropdown. */
  onCreated?: (name: string) => void;
};

export default function CreateOwnerDrawer({
  onClose,
  heading = "Create owner",
  submitLabel = "Create owner",
  requireRole = false,
  showRole = true,
  onCreated,
}: CreateOwnerDrawerProps) {
  const { owners, addOwner } = useBacklog();
  const toast = useToast();

  return (
    <OwnerFormDrawer
      heading={heading}
      submitLabel={submitLabel}
      requireRole={requireRole}
      showRole={showRole}
      onClose={onClose}
      onSave={async (name, role, team) => {
        const duplicate = owners.some((o) => o.toLowerCase() === name.trim().toLowerCase());
        const created = await addOwner(name, role || undefined, team || undefined);
        if (!created) return "Couldn't create the owner. Please try again.";
        toast.show(duplicate ? `${created} already exists` : `${created} added`, duplicate ? "info" : "success");
        onCreated?.(created);
        return "ok";
      }}
    />
  );
}
