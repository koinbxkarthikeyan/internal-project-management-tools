import EmptyState from "./EmptyState";

/** What an empty board column shows: the empty-table picture with the KoinBX badge and a short line, in a dashed box that fills the column's fixed minimum height (the height of a column holding one card), so the columns of a board are the same size and an empty column does not grow when another column's card opens out. */
export default function ColumnEmpty({ children }: { children: string }) {
  return (
    <div className="flex min-h-36 flex-1 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border">
      <EmptyState compact title={children} />
    </div>
  );
}
