"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { UsersIcon } from "@/components/ui/icons";
import { MESSAGES_LABEL, MY_TASK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUsers } from "@/features/users/hooks/useUsers";
import { onExternalChange } from "@/lib/localApi";
import * as chat from "@/services/messageService";
import Avatar from "./Avatar";
import ChatPane from "./ChatPane";

const OPEN_KEY = "koinbx.messages.open";
/** The conversations that were open before a reload (kept for this tab only; a conversation that no longer exists is simply not shown). */
const readOpen = (): string[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string").slice(-MAX_OPEN) : [];
  } catch {
    return [];
  }
};
const writeOpen = (keys: string[]) => {
  try {
    sessionStorage.setItem(OPEN_KEY, JSON.stringify(keys));
  } catch {
    // storage is not available: the choice just isn't remembered
  }
};

/** How many conversations can be open side by side. */
const MAX_OPEN = 3;
const when = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

function Badge({ n }: { n: number }) {
  return n > 0 ? <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent-foreground">{n > 99 ? "99+" : n}</span> : null;
}

/**
 * Messages: a group chat for each POD the person is in (the Lead and the Assigned Users of a task) and a one-to-one conversation with any other person.
 * Up to three conversations can be open side by side; picking an open one in the list closes it, and opening a fourth closes the oldest.
 */
export default function MessagesPage() {
  const { user } = useAuth();
  const users = useUsers();
  const [overview, setOverview] = useState<chat.ChatOverview | null>(null);
  // A link can name the conversation to open (?open=task:5 or ?open=dm:3); it is shown with the ones that were already open.
  const [picked, setPickedState] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const wanted = new URLSearchParams(window.location.search).get("open");
    const kept = readOpen().filter((k) => k !== wanted);
    return (wanted ? [...kept, wanted] : kept).slice(-MAX_OPEN);
  });
  const setPicked = (keys: string[]) => (setPickedState(keys), writeOpen(keys));
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const others = useMemo(() => users.filter((u) => u.id !== user?.id && u.status !== "Disabled"), [users, user?.id]);
  const pods = overview?.pods ?? [];


  const refresh = useCallback(async () => {
    try {
      setOverview(await chat.getOverview());
    } catch {
      // the next refresh tries again
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const off = onExternalChange(() => void refresh());
    return () => (clearTimeout(first), off());
  }, [refresh]);

  const nameOf = (id: string) => (id === user?.id ? "You" : users.find((u) => u.id === id)?.name ?? "Someone");
  const exists = (key: string) => pods.some((p) => p.key === key) || others.some((u) => `dm:${u.id}` === key);
  // The open conversations: those picked that still exist, else the first POD.
  const open = picked.filter(exists).length ? picked.filter(exists) : pods[0] ? [pods[0].key] : [];
  const hasOpen = open.length > 0;

  // The workspace takes all the room from where it starts to the bottom of the screen (keeping the page's own bottom padding), so no space is left unused. At least 480px, except on a phone (240px),
  // where the screen can be only a little taller than that while the keyboard is open: the message box and its buttons must stay in view.
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = workspaceRef.current;
      if (el) el.style.height = `${Math.max(window.matchMedia("(max-width: 767px)").matches ? 240 : 480, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 32)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // Fitted again when a conversation opens or closes: on a phone the heading goes while one is open, so the chat starts higher.
  }, [hasOpen]);
  // On a phone the list and the open chat take turns (one screen each): "showList" is the list while a chat is open. The ← in a chat opens the list without closing the chat, and picking
  // a conversation there shows it (one already open is brought to the front, not closed).
  const [showList, setShowList] = useState(false);
  const phone = () => window.matchMedia("(max-width: 767px)").matches;
  const toggle = (key: string) => {
    if (phone() && hasOpen) {
      setPicked([...open.filter((k) => k !== key), key].slice(-MAX_OPEN));
      setShowList(false);
      return;
    }
    setPicked(open.includes(key) ? open.filter((k) => k !== key) : [...open, key].slice(-MAX_OPEN));
  };

  const q = search.trim().toLowerCase();
  const people = others
    .filter((u) => (!q || u.name.toLowerCase().includes(q)) && (!unreadOnly || (overview?.dms[u.id]?.unread ?? 0) > 0 || open.includes(`dm:${u.id}`)))
    .sort((a, b) => (overview?.dms[b.id]?.last?.createdAt ?? "").localeCompare(overview?.dms[a.id]?.last?.createdAt ?? "") || a.name.localeCompare(b.name));
  const wanted = (p: chat.ChatPod) => (!q || `${p.code} ${p.title}`.toLowerCase().includes(q)) && (!unreadOnly || p.unread > 0 || open.includes(p.key));
  // A Ticket is listed under its task. A Ticket whose task the person is not on (so it has no chat for them) is listed on its own, naming its task.
  const byId = new Map(pods.map((p) => [p.taskId, p]));
  const ticketsOf = (id: number) => pods.filter((t) => t.parentId === id);
  const groups = pods
    .filter((p) => p.parentId == null || !byId.has(p.parentId))
    .map((parent) => ({ parent, tickets: ticketsOf(parent.taskId) }))
    .filter(({ parent, tickets }) => wanted(parent) || tickets.some(wanted));
  const podsShown = groups.map((g) => g.parent);
  const totalUnread = pods.reduce((n, p) => n + p.unread, 0) + Object.values(overview?.dms ?? {}).reduce((n, d) => n + d.unread, 0);
  const row = (on: boolean) => `relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent-soft" : "hover:bg-hover"}`;
  const bar = (on: boolean) => on && <span aria-hidden="true" className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent" />;
  // A task's row also carries its Tickets: their messages are read in the task's panel, so their unread count is added to the task's.
  const pod = (p: chat.ChatPod, tickets: chat.ChatPod[]) => {
    const on = open.includes(p.key);
    const unread = p.unread + tickets.reduce((n, t) => n + t.unread, 0);
    const latest = [p, ...tickets].map((x) => x.last).filter((m): m is chat.ChatMessage => !!m).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
    return (
      <button key={p.key} type="button" onClick={() => toggle(p.key)} aria-pressed={on} className={row(on)}>
        {bar(on)}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><UsersIcon /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}>{p.title}</span>
            <span className="shrink-0 text-[10px] text-muted">{when(latest?.createdAt)}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted">{latest ? `${nameOf(latest.fromId)}: ${chat.previewOf(latest)}` : `${p.code} · ${p.members.length} ${p.members.length === 1 ? "person" : "people"}`}{tickets.length ? ` · ${tickets.length} ${tickets.length === 1 ? "Ticket" : "Tickets"}` : ""}</span>
            <Badge n={unread} />
          </span>
        </span>
      </button>
    );
  };
  // Only what is unread is a number in the list (on a conversation); a section's heading is just its name.
  const section = (label: string) => <h2 className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</h2>;

  return (
    <div className="flex flex-col gap-4">
      <div className={hasOpen ? "hidden md:block" : undefined}>
        <PageHeader title={MESSAGES_LABEL} description="Chat with the people on your tasks (your PODs) and with anyone else. Open up to three conversations side by side." />
      </div>
      <div ref={workspaceRef} className="flex h-[30rem] min-h-0 overflow-hidden card shadow-sm">
        <aside className={`${hasOpen && !showList ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border bg-surface md:w-80`} aria-label="Conversations">
          <div className="p-3 pb-1">
            <div className="relative">
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>
              <input style={{ outline: "none" }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PODs and people" aria-label="Search PODs and people" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted focus-visible:border-accent" />
            </div>
            <div className="mt-2 flex gap-1" role="group" aria-label="Show">
              {([["All", false], [`Unread${totalUnread ? ` (${totalUnread})` : ""}`, true]] as const).map(([label, v]) => (
                <button key={label} type="button" onClick={() => setUnreadOnly(v)} aria-pressed={unreadOnly === v} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${unreadOnly === v ? "bg-accent text-accent-foreground" : "bg-hover text-muted hover:text-foreground"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {overview === null && (
              <div className="flex flex-col gap-2 px-3 pt-4" aria-label="Loading conversations" role="status">
                {[0, 1, 2, 3].map((n) => (
                  <div key={n} className="flex animate-pulse items-center gap-3">
                    <span className="h-10 w-10 rounded-full bg-hover" />
                    <span className="flex flex-1 flex-col gap-1.5"><span className="h-3 w-2/3 rounded bg-hover" /><span className="h-2.5 w-1/2 rounded bg-hover" /></span>
                  </div>
                ))}
              </div>
            )}
            {section("My PODs")}
            {podsShown.length === 0 && <p className="px-3 py-2 text-xs leading-relaxed text-muted">{q || unreadOnly ? "Nothing to show." : "A POD appears for every task you lead or are assigned to."}</p>}
            {groups.map(({ parent, tickets }) => (
              <div key={parent.key}>{pod(parent, tickets)}</div>
            ))}
            {section("Direct messages")}
            {people.length === 0 && <p className="px-3 py-2 text-xs text-muted">{q || unreadOnly ? "Nothing to show." : "No one else to message yet."}</p>}
            {people.map((u) => {
              const s = overview?.dms[u.id];
              const key = `dm:${u.id}`;
              const on = open.includes(key);
              return (
                <button key={u.id} type="button" onClick={() => toggle(key)} aria-pressed={on} className={row(on)}>
                  {bar(on)}
                  <Avatar name={u.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${s?.unread ? "font-semibold" : "font-medium"}`}>{u.name}</span>
                      <span className="shrink-0 text-[10px] text-muted">{when(s?.last?.createdAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted">{s?.last ? `${s.last.fromId === user?.id ? "You: " : ""}${chat.previewOf(s.last)}` : u.team || u.role}</span>
                      <Badge n={s?.unread ?? 0} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className={`${hasOpen && !showList ? "flex" : "hidden md:flex"} min-w-0 flex-1 gap-2 overflow-x-auto bg-background/60 p-2`}>
          {open.length === 0 ? (
            <div className="m-auto flex flex-col items-center gap-2 px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><UsersIcon width={26} height={26} /></span>
              <p className="text-sm font-semibold">Your messages</p>
              <p className="max-w-64 text-xs text-muted">Pick a POD or a person on the left. You can keep up to three conversations open side by side.</p>
            </div>
          ) : (
            open.map((key, index) => {
              // Phones show only the newest open conversation and tablets the newest two; wide screens show all of them.
              const hide = index < open.length - 1 ? "hidden md:flex" : "";
              const hideThird = open.length === 3 && index === 0 ? "md:hidden xl:flex" : "";
              const pod = pods.find((p) => p.key === key);
              const person = others.find((u) => `dm:${u.id}` === key);
              return (
                <ChatPane
                  key={key}
                  convKey={key}
                  title={pod ? `${pod.code} · ${pod.title}` : person?.name ?? ""}
                  subtitle={pod ? `${pod.members.length} ${pod.members.length === 1 ? "participant" : "participants"} · ${pod.code}${ticketsOf(pod.taskId).length ? ` · ${ticketsOf(pod.taskId).length} ${ticketsOf(pod.taskId).length === 1 ? "Ticket" : "Tickets"}` : ""}` : person?.team || "Direct message"}
                  members={pod?.members.map((m) => m.name)}
                  people={pod ? pod.members.filter((m) => m.id !== user?.id) : person ? [{ id: person.id, name: person.name }] : []}
                  status={pod?.status}
                  tickets={pod ? ticketsOf(pod.taskId) : undefined}
                  href={pod ? `${MY_TASK_HREF}/task?id=${pod.taskId}` : undefined}
                  myId={user?.id ?? ""}
                  nameOf={nameOf}
                  unread={(pod ? pod.unread : overview?.dms[person?.id ?? ""]?.unread) ?? 0}
                  onChanged={refresh}
                  onBack={() => setShowList(true)}
                  onClose={() => setPicked(open.filter((k) => k !== key))}
                  className={`${hide} ${hideThird}`.trim()}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
