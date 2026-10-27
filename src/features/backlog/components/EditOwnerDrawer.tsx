"use client";

import { useToast } from "@/components/ui/Toast";
import { useBacklog } from "../context/BacklogContext";
import OwnerFormDrawer from "./OwnerFormDrawer";

type EditOwnerDrawerProps = {
  owner: string;
  onClose: () => void;
};

export default function EditOwnerDrawer({ owner, onClose }: EditOwnerDrawerProps) {
  const { updateOwner, ownerRecords } = useBacklog();
  const toast = useToast();

  return (
    <OwnerFormDrawer
      heading="Edit owner"
      submitLabel="Save owner"
      editing
      showRole={false} // same two fields as Create owner (Name, Team); the saved role is kept as it is
      initialName={owner}
      initialRole={ownerRecords.find((o) => o.name === owner)?.role}
      initialTeam={ownerRecords.find((o) => o.name === owner)?.team}
      onClose={onClose}
      onSave={async (name, role, team) => {
        const result = await updateOwner(owner, name, role, team);
        if (result === "empty") return "Name can't be empty.";
        if (result === "duplicate") return `An owner named "${name.trim()}" already exists.`;
        if (result === "locked") return "This owner can't be edited.";
        if (result === "error") return "Couldn't save the owner. Please try again.";
        toast.show(`Owner renamed to ${name.trim()}`);
        return "ok";
      }}
    />
  );
}
