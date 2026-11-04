import TaskComments from "./TaskComments";

/** A task's conversation in the same card a Ticket's has, for the screens that show the history separately (the task panels and the Edit drawer). `fill` lets it use the height of the page. */
export default function CommentsCard({ taskId, fill = false, reloadToken = 0 }: { taskId: string; fill?: boolean; /** Changes when the task was saved (a status note becomes a comment), so the conversation is read again. */ reloadToken?: number }) {
  return (
    <section aria-label="Comments" className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <TaskComments taskId={taskId} fill={fill} reloadToken={reloadToken} />
    </section>
  );
}
