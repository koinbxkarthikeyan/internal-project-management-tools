import { sprintLabel } from "@/constants/backlog-options";
import { todayISO } from "@/features/backlog/utils";
import type { Sprint } from "@/types/backlog";
import type { WorkEntry } from "@/types/work";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type WorkExportInput = {
  /** Everyone to list, including people who have logged nothing. */
  people: readonly string[];
  /** Their logged work in the sprints being looked at. */
  entries: readonly WorkEntry[];
  sprints: readonly Sprint[];
  /** Team per person (from their profile). */
  teams?: Readonly<Record<string, string>>;
  /** Hours one person is expected to have logged so far, and over the whole of the sprints. */
  expectedSoFar: number;
  sprintTotal: number;
};

/**
 * One workbook with everyone's working details: a "By person" sheet (one row per employee with entries, hours and standing) and an "Entries"
 * sheet (every logged piece of work). Built from the data already on screen; nothing is requested again and no password or token is ever written.
 */
export async function downloadWorkExcel({ people, entries, sprints, teams = {}, expectedSoFar, sprintTotal }: WorkExportInput) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const sprintName = (id: string) => sprintLabel(sprints.find((s) => s.id === id)?.name ?? "");
  const round = (n: number) => Math.round(n * 100) / 100;

  const sheet = (name: string, columns: { header: string; key: string; width: number }[], rows: Record<string, string | number>[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns;
    ws.addRows(rows);
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.alignment = { vertical: "middle" };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  };

  const all = [...new Set([...people, ...entries.map((e) => e.person)])].sort((a, b) => a.localeCompare(b));
  sheet(
    "By person",
    [
      { header: "Employee", key: "person", width: 28 },
      { header: "Team", key: "team", width: 16 },
      { header: "Entries", key: "entries", width: 10 },
      { header: "Logged hours", key: "hours", width: 14 },
      { header: "Expected so far (h)", key: "soFar", width: 20 },
      { header: "Total sprint hours (h)", key: "total", width: 22 },
      { header: "% of sprint hours", key: "pct", width: 18 },
      { header: "Status", key: "status", width: 18 },
    ],
    all.map((person) => {
      const mine = entries.filter((e) => e.person === person);
      const hours = mine.reduce((s, e) => s + e.hours, 0);
      return {
        person,
        team: teams[person] ?? "",
        entries: mine.length,
        hours: round(hours),
        soFar: expectedSoFar,
        total: sprintTotal,
        pct: sprintTotal > 0 ? Math.round((hours / sprintTotal) * 100) : 0,
        status: mine.length ? "Work logged" : "No work logged yet",
      };
    }),
  );

  sheet(
    "Entries",
    [
      { header: "Employee", key: "person", width: 28 },
      { header: "Sprint", key: "sprint", width: 16 },
      { header: "POD", key: "pod", width: 20 },
      { header: "Kind of work", key: "kind", width: 14 },
      { header: "Task", key: "task", width: 40 },
      { header: "From", key: "from", width: 12 },
      { header: "To", key: "to", width: 12 },
      { header: "Hours", key: "hours", width: 9 },
      { header: "Notes", key: "notes", width: 40 },
    ],
    [...entries]
      .sort((a, b) => a.person.localeCompare(b.person) || a.from.localeCompare(b.from))
      .map((e) => ({ person: e.person, sprint: sprintName(e.sprintId), pod: e.pod, kind: e.kind, task: e.task, from: e.from, to: e.to, hours: round(e.hours), notes: e.notes ?? "" })),
  );

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_TYPE }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-work-details-${todayISO()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
