import { BoardIcon, ListIcon } from "@/components/ui/icons";

/** The List / Board switch (not shown on a phone, where every list is a list and the board is not offered): two buttons, each with its icon and name (on a phone just the icon, the name kept for screen readers and as a tooltip), the chosen one highlighted. */
export default function ViewToggle({ value, onChange, label = "View" }: { value: "list" | "board"; onChange: (view: "list" | "board") => void; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-lg border border-border text-xs font-medium max-md:hidden">
      {([["list", "List", ListIcon], ["board", "Board", BoardIcon]] as const).map(([v, text, Icon]) => (
        <button key={v} type="button" title={text} aria-pressed={value === v} onClick={() => onChange(v)} className={`flex h-8 items-center gap-1.5 px-2.5 transition-colors sm:px-3 duration-150 focus-visible:outline-2 focus-visible:outline-accent ${value === v ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`}>
          <Icon width={14} height={14} />
          <span className="sr-only sm:not-sr-only">{text}</span>
        </button>
      ))}
    </div>
  );
}
