"use client";

import ActionsMenu from "@/components/ui/ActionsMenu";
import { EyeIcon, EyeOffIcon, TrashIcon } from "@/components/ui/icons";
import type { BacklogItemData } from "@/types/backlog";

type RowActionsMenuProps = {
  item: BacklogItemData;
  onToggleHidden: () => void;
  onDelete: () => void;
};

/** Row menu for a backlog item: Hide in the Visible tab (a row click opens Edit); Unhide and Delete in the Hidden tab. */
export default function RowActionsMenu({ item, onToggleHidden, onDelete }: RowActionsMenuProps) {
  const HideIcon = item.hidden ? EyeIcon : EyeOffIcon;

  return (
    <ActionsMenu
      label={`Actions for ${item.title}`}
      actions={[
        { key: "hide", label: item.hidden ? "Unhide" : "Hide", icon: <HideIcon />, onSelect: onToggleHidden },
        // Delete is only offered in the Hidden tab. Editing is done by clicking the row.
        ...(item.hidden ? [{ key: "delete", label: "Delete", icon: <TrashIcon />, onSelect: onDelete, danger: true }] : []),
      ]}
    />
  );
}
