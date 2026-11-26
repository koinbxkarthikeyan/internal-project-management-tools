import { CloseIcon } from "@/components/ui/icons";

/** The close button of every modal, drawer and panel: the same × icon, size and hover motion everywhere (the turn and the red come from globals.css, for any button named "Close"). */
export default function ModalClose({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
      <CloseIcon width={16} height={16} />
    </button>
  );
}
