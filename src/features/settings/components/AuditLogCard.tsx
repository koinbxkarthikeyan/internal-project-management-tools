"use client";

import { useEffect, useState } from "react";
import FitList from "@/components/ui/FitList";
import SettingsCard from "./SettingsCard";
import { apiClient, getErrorMessage } from "@/lib/apiClient";

type Line = { id: number; at: string; actorName: string; action: string; target: string; detail?: string };


const WORDS: Record<string, string> = {
  "user.role_changed": "Changed a role",
  "user.access_changed": "Changed access",
  "user.email_changed": "Changed an email",
  "user.team_changed": "Changed a team",
  "user.password_reset": "Reset a password",
  "user.password_changed": "Changed own password",
  "user.deleted": "Deleted a user",
  "task.deleted": "Deleted a task",
  "ticket.deleted": "Deleted a Ticket",
  "tasks.hidden_removed": "Removed hidden tasks",
  "owner.deleted": "Deleted an owner",
  "sprint.deleted": "Deleted a sprint",
  "backup.exported": "Exported a backup",
  "backup.restored": "Restored a backup",
  "data.imported": "Imported browser data",
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

/** For the Super Admin: who changed roles, access and passwords, deleted things, and exported or restored the data (the newest 100 lines; the server keeps 5,000). */
export default function AuditLogCard() {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiClient.get<Line[]>("/audit", { params: { limit: 100 } }).then(
      (res) => setLines(res.data),
      (err) => setError(getErrorMessage(err)),
    );
  }, []);
  return (
    <SettingsCard title="Audit log" description="What was changed, by whom and when. Only the Super Admin can read it. It never holds a password.">
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : lines === null ? (
        <p role="status" className="text-sm text-muted">Loading…</p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-muted">Nothing has been recorded yet.</p>
      ) : (
        <FitList bottom={48} min={240} className="divide-y divide-border rounded-xl border border-border">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{WORDS[l.action] ?? l.action}</span>
                <span className="min-w-0 break-words text-muted">{l.target}</span>
              </span>
              <span className="text-xs text-muted">
                {l.actorName} · {when(l.at)}
                {l.detail ? ` · ${l.detail}` : ""}
              </span>
            </li>
          ))}
        </FitList>
      )}
    </SettingsCard>
  );
}
