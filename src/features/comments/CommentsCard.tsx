import { MESSAGES_LABEL } from "@/constants/work";
import TaskComments from "./TaskComments";

/** A task's conversation in the same card a Ticket's has, for the screens that show the history separately (the task panels and the Edit drawer). `fill` lets it use the height of the page. */
export default function CommentsCard({ taskId, fill = false, reloadToken = 0 }: { taskId: string; fill?: boolean; /** Changes when the task was saved (a status note becomes a comment), so the conversation is read again. */ reloadToken?: number }) {
  return (
    <section aria-label={MESSAGES_LABEL} className="min-w-0 card p-4">
      <TaskComments taskId={taskId} fill={fill} reloadToken={reloadToken} />
    </section>
  );
}
