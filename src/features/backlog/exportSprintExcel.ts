import { sprintLabel } from "@/constants/backlog-options";
import type { BacklogItemData, Sprint, Status } from "@/types/backlog";
import { todayISO } from "./utils";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type SprintExportScope = "active" | "backlog" | "all" | { sprint: string };

type Input = {
  scope: SprintExportScope;
  items: readonly BacklogItemData[];
  sprints: readonly Sprint[];
};

/** The team's own wording for a status in the sprint sheet (the way the planning sheet has always been kept). */
const SHEET_STATUS: Record<Status, string> = {
  Open: "To-Do",
  "In progress": "Development",
  "Ready for QA": "QA",
  Testing: "QA",
  Blocked: "Blocker",
  "On hold": "On hold",
  Done: "Done",
};
export const sheetStatus = (status: Status) => SHEET_STATUS[status] ?? status;

// The columns of the planning sheet, in its order and with its headings.
const COLUMNS = [
  { header: "Task Name", key: "name", width: 38 },
  { header: "Description", key: "description", width: 62 },
  { header: "Tech POD lead", key: "lead", width: 22 },
  { header: "Current Status", key: "status", width: 17 },
  { header: "Additional Information", key: "info", width: 50 },
  { header: "Developer Planned Date", key: "developer", width: 24 },
  { header: "Business Deadline", key: "business", width: 20 },
  { header: "Sprint Planned", key: "sprint", width: 16 },
  { header: "Sprint Range", key: "range", width: 18 },
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov9" for 2026-11-09, the way the sprint range is written in the sheet. */
const shortDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : `${MONTHS[d.getUTCMonth()]}${d.getUTCDate()}`;
};
const rangeOf = (s?: Sprint) => (s?.start && s.end ? `${shortDay(s.start)}-${shortDay(s.end)}` : "-");

/** The real sprints (not the Backlog stand-in) from the earliest to the latest, the order the planning sheet lists them in. */
export const exportableSprints = (sprints: readonly Sprint[]) =>
  sprints.filter((s) => s.name !== "Unplanned").sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "") || a.name.localeCompare(b.name, undefined, { numeric: true }));

const byId = (a: BacklogItemData, b: BacklogItemData) => a.id.localeCompare(b.id, undefined, { numeric: true });

/**
 * Downloads the Sprint plan as one Excel file in the team's planning-sheet format: a single table with Task Name, Description, Tech POD lead, Current Status, Additional Information,
 * Developer Planned Date (the Developer ETA), Business Deadline (the Expected ETA), Sprint Planned and Sprint Range. It lists the running sprint, the Backlog, or every sprint from the
 * earliest to the latest and then the Backlog. It is built from the data already on the page (nothing is requested again); hidden tasks are not on the Sprint plan, so they are not here.
 */
export async function downloadSprintExcel({ scope, items, sprints }: Input): Promise<void> {
  const real = exportableSprints(sprints);
  const active = real.find((s) => s.status === "Active");
  const backlog = items.filter((i) => i.sprint === "Unplanned").sort(byId);
  const inSprint = (s: Sprint) => items.filter((i) => i.sprint === s.name).sort(byId);

  // The tasks in groups: a sprint, or the Backlog. A single group is just the table; several are told apart by a labelled band row (the column heading is only at the top).
  type Group = { label: string; sprint?: Sprint; items: BacklogItemData[] };
  let groups: Group[];
  let separated = false;
  let sheetName: string;
  let file: string;
  if (typeof scope === "object") {
    // One named sprint (or the Backlog, as "Unplanned"), from the button in its own card.
    const sp = real.find((x) => x.name === scope.sprint);
    if (!sp) {
      groups = [{ label: "Backlog", items: backlog }];
      sheetName = "Backlog";
      file = "backlog";
    } else {
      groups = [{ label: sp.name, sprint: sp, items: inSprint(sp) }];
      sheetName = sp.name;
      file = `sprint-${sp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    }
  } else if (scope === "active") {
    if (!active) return;
    groups = [{ label: active.name, sprint: active, items: inSprint(active) }];
    sheetName = active.name;
    file = `sprint-${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  } else if (scope === "backlog") {
    groups = [{ label: "Backlog", items: backlog }];
    sheetName = "Backlog";
    file = "backlog";
  } else {
    groups = [...real.map((s) => ({ label: s.name, sprint: s, items: inSprint(s) })), { label: "Backlog", items: backlog }];
    separated = true;
    sheetName = "All sprints";
    file = "all-sprints-and-backlog";
  }

  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sprint", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // A date is a real Excel date (so it filters and sorts as one), shown as 25/11/2026; no date is a dash.
  const date = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : "-");
  const bands = new Set<number>();
  const stateWord = (sp?: Sprint) => (sp?.status === "Active" ? "Running" : sp?.status === "Closed" ? "Closed" : sp ? "Planned" : "");
  for (const group of groups) {
    if (separated) {
      const detail = [group.sprint ? rangeOf(group.sprint) : "", `${group.items.length} ${group.items.length === 1 ? "task" : "tasks"}`, stateWord(group.sprint)].filter(Boolean).join(" · ");
      // every column gets a cell, so the shading runs the whole width
      bands.add(ws.addRow([`${group.label} · ${detail}`, ...COLUMNS.slice(1).map(() => "")]).number);
    }
    for (const item of group.items) {
      const sprint = group.sprint;
      ws.addRow({
        name: item.title,
        description: item.description ?? "",
        lead: item.lead || (item.owner !== "Unassigned" ? item.owner : ""),
        status: sheetStatus(item.status),
        // The notes, and why a Blocked or On hold task is waiting.
        info: [item.notes, item.blockedReason && (item.status === "Blocked" || item.status === "On hold") ? item.blockedReason : ""].filter((t) => t && t.trim()).join("\n"),
        developer: date(item.leadDeadline),
        business: date(item.deadline),
        sprint: sprintLabel(item.sprint),
        range: rangeOf(sprint),
      });
    }
  }

  const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
  ws.eachRow((row, n) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      cell.alignment = { vertical: n === 1 ? "middle" : "top", wrapText: true, ...(typeof cell.value === "object" && cell.value instanceof Date ? { horizontal: "right" as const } : {}) };
    });
  });
  ws.getRow(1).font = { bold: true };
  // A sprint band: bold on a light fill across the whole width, its text running over the empty cells beside it.
  for (const n of bands) {
    const band = ws.getRow(n);
    band.font = { bold: true };
    band.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EDF7" } };
      cell.alignment = { vertical: "middle", wrapText: false };
    });
  }
  ws.getColumn("developer").numFmt = "dd/mm/yyyy";
  ws.getColumn("business").numFmt = "dd/mm/yyyy";
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_TYPE }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${file}-${todayISO()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
