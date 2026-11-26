"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, CloseIcon, UsersIcon } from "@/components/ui/icons";
import { SearchableSelect } from "@/components/ui/FormControls";
import { StatusBadge, StatusIcon } from "@/components/ui/Badge";
import { MY_TASK_HREF } from "@/constants/work";
import type { Status } from "@/types/backlog";
import * as chat from "@/services/messageService";
import type { ChatPod } from "@/services/messageService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import Avatar from "./Avatar";
import ChatThread from "./ChatThread";
import { useThread } from "./useThread";

/** Up to this many Tickets get a tab each; more are chosen from a list. */
const TABS = 3;

type Props = {
  /** "task:<id>" (a POD) or "dm:<person id>". */
  convKey: string;
  title: string;
  subtitle: string;
  /** A POD shows who wrote each message and who is in it. */
  members?: string[];
  myId: string;
  nameOf: (id: string) => string;
  /** Messages this person has not read here (from the overview): a pane that shows them marks them read. */
  unread: number;
  /** Something changed (a message was sent or read): the conversation list should be read again. */
  onChanged: () => void;
  onClose: () => void;
  /** On a phone: back to the list of conversations, leaving this one open. */
  onBack?: () => void;
  /** The Tickets of this task: their messages are shown inside this panel, as sections that open and close. */
  tickets?: ChatPod[];
  /** Who can be @mentioned here: the other person in a direct chat, the people on the task in a group. */
  people?: readonly { id: string; name: string }[];
  /** A POD's task status, shown in the header. */
  status?: Status;
  /** A POD's title opens its task here. */
  href?: string;
  /** Extra classes for the column (the page hides the older columns on narrow screens). */
  className?: string;
};

/** One open conversation: its messages (refreshed when somebody else changes the shared data) and the box to write in. A task also carries its Tickets' messages. Several can be open side by side. */
export default function ChatPane({ convKey, title, subtitle, members, myId, nameOf, unread, onChanged, onClose, onBack, href, status, people, tickets = [], className = "" }: Props) {
  const { isAdmin } = useAuth();
  const group = !!members;
  const withTickets = tickets.length > 0;
  // A task with Tickets has a tab for the task and one for each Ticket (its name and code); one conversation is shown at a time, and a message goes to the one shown.
  const [scope, setScope] = useState<"task" | number>("task");
  const all = useThread(convKey, myId, unread, onChanged, withTickets, false);
  const focused = typeof scope === "number" ? tickets.find((t) => t.taskId === scope) : undefined;
  const shownKey = focused ? focused.key : convKey;
  const shownUnread = focused ? focused.unread : unread;
  const messages = all.messages && all.messages.filter((m) => (focused ? m.taskId === focused.taskId : m.taskId == null));
  // What is on screen is what gets marked read: a Ticket's unread messages stay unread until its tab is opened.
  useEffect(() => {
    if (shownUnread > 0 && all.messages) void chat.markRead(shownKey).then(onChanged, () => undefined);
  }, [shownKey, shownUnread, all.messages, onChanged]);
  return (
    <section aria-label={title} className={`anim-fade-up relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-xl border border-border bg-surface md:min-w-[19rem] ${className}`}>
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <button type="button" onClick={onBack ?? onClose} aria-label="Back to conversations" className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-hover hover:text-foreground md:hidden focus-visible:outline-2 focus-visible:outline-accent">
          <ChevronLeftIcon width={18} height={18} />
        </button>
        {group ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><UsersIcon /></span>
        ) : (
          <Avatar name={title} size={40} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold leading-tight">
            {href ? <Link href={href} title="Open the task" className="rounded hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{title}</Link> : title}
          </h2>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        {status && <span className="shrink-0"><StatusBadge status={status} /></span>}
        {members && (
          <div className="hidden items-center -space-x-2 sm:flex" aria-label={`${members.length} people`}>
            {members.slice(0, 3).map((n) => <Avatar key={n} name={n} size={24} ring />)}
            {members.length > 3 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-hover px-1 text-[10px] font-semibold text-muted ring-2 ring-surface">+{members.length - 3}</span>}
          </div>
        )}
        <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent md:grid">
          <CloseIcon width={16} height={16} />
        </button>
      </header>

      {withTickets && (
        <div className="border-b border-border">
          {/* What to show: the task's own messages or one of its Tickets. A few Tickets get a tab each; many (more than TABS) are chosen from one list, so the row stays one line. */}
          <div className="flex items-center gap-1 px-3" role="tablist" aria-label="Show messages of">
            {([["task", "Task", null, unread], ...(tickets.length <= TABS ? tickets.map((t) => [t.taskId, `${t.code} · ${t.title}`, t.status, t.unread] as const) : [])] as const).map(([id, label, status, n]) => {
              const on = scope === id || (typeof scope === "number" && !focused && id === "task");
              return (
                <button key={String(id)} type="button" role="tab" aria-selected={on} onClick={() => setScope(id)} title={label} className={`-mb-px flex min-w-0 max-w-[14rem] shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${on ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}>
                  {status && <StatusIcon status={status} />}
                  <span className="truncate">{label}</span>
                  {n > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-accent-foreground">{n}</span>}
                </button>
              );
            })}
            {tickets.length > TABS && (
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 py-1.5 text-xs text-muted sm:flex-none">
                <span className="hidden shrink-0 sm:inline">Tickets ({tickets.length})</span>
                {/* A searchable list: type a Ticket's code or title to find it. */}
                <SearchableSelect
                  ariaLabel="Choose a Ticket"
                  placeholder="Choose a Ticket…"
                  value={focused ? String(focused.taskId) : ""}
                  onChange={(v) => setScope(v === "" ? "task" : Number(v))}
                  options={tickets.map((t) => ({ value: String(t.taskId), label: `${t.code} · ${t.title}${t.unread > 0 ? ` (${t.unread} new)` : ""}` }))}
                  inputClassName="h-8 text-xs"
                  className="w-full sm:w-64"
                />
                {tickets.some((t) => t.unread > 0) && <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-accent-foreground">{tickets.reduce((n, t) => n + t.unread, 0)}</span>}
              </div>
            )}
          </div>
          {/* A Ticket chosen: its name, its status and the way to its own page. */}
          {focused && (
            <div className="flex items-center gap-2 border-t border-border/60 bg-background/50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-muted">Ticket of {title}</span>
              <StatusBadge status={focused.status} />
              <Link href={`${MY_TASK_HREF}/ticket?id=${focused.taskId}`} className="shrink-0 rounded text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Open Ticket</Link>
            </div>
          )}
        </div>
      )}
      <div key={String(scope)} className="anim-tab-in flex min-h-0 flex-1 flex-col">
        <ChatThread
          thread={all}
          messages={messages}
          convKey={shownKey}
          label={focused ? `${focused.code} · ${focused.title}` : title}
          myId={myId}
          nameOf={nameOf}
          people={people}
          deleteOthers={group && isAdmin}
          newFrom={withTickets ? null : all.newFrom}
          className="flex-1"
          empty={
            <div className="mt-8 flex flex-col items-center gap-2 text-center">
              <Avatar name={title} size={48} />
              <p className="text-sm font-medium">{title}</p>
              <p className="max-w-56 text-xs text-muted">{group ? "This is the start of the POD's chat. Everyone on the task sees it." : "No messages yet. Say hello."}</p>
            </div>
          }
        />
      </div>
    </section>
  );
}
