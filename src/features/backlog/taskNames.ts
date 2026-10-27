/** Task names compare without leading or trailing spaces and without regard to upper or lower case. */
export const DUPLICATE_TASK_MESSAGE = "A task with this name already exists. Please use a different name.";

export const taskNameKey = (title: string) => title.trim().toLowerCase();

/** Whether a task with this name is already in `tasks` (give it every task: Backlog, running, planned and closed sprints, hidden ones too). */
export function taskNameTaken(title: string, tasks: readonly { title: string }[]): boolean {
  const key = taskNameKey(title);
  return key !== "" && tasks.some((t) => taskNameKey(t.title) === key);
}
