import EmptyState from "./EmptyState";

/** What an empty board column shows: the empty-table picture with the KoinBX badge and a short line, in a box of a fixed height, so an empty column stays compact whatever the other columns hold. */
export default function ColumnEmpty({ children }: { children: string }) {
  return (
    <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border">
      <EmptyState compact title={children} />
    </div>
  );
}
