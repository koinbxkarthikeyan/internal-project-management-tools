/**
 * The order of tasks inside one list (a sprint, or the Backlog), with no screen in it and nothing about which sprint a task is in. A list's order is
 * just the task ids in the order to show them; a task with no saved place is listed after the saved ones, in the order it already had.
 */
export function applyOrder<T extends { id: string }>(items: readonly T[], saved: readonly string[] | undefined): T[] {
  if (!saved?.length) return [...items];
  const at = new Map(saved.map((id, i) => [id, i]));
  return items.map((item, i) => ({ item, i })).sort((a, b) => (at.get(a.item.id) ?? 1e9 + a.i) - (at.get(b.item.id) ?? 1e9 + b.i)).map((x) => x.item);
}

/** One step up (-1) or down (+1) inside `ids`; the same list back at the ends. */
export function stepIds(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** `id` taken out and put just before (or, with `after`, just after) `target`. */
export function dropIds(ids: readonly string[], id: string, target: string, after: boolean): string[] {
  if (id === target || !ids.includes(id) || !ids.includes(target)) return [...ids];
  const rest = ids.filter((x) => x !== id);
  const at = rest.indexOf(target) + (after ? 1 : 0);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
