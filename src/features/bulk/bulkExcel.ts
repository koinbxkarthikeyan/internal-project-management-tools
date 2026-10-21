import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";
import { todayISO } from "@/features/backlog/utils";
import { BULK_SPECS, resolveOne, tokens, type BulkType, type Column, type Ctx, type Option, type PickOptionData, type Values } from "./bulkSpecs";
import { isBlankValues } from "./bulkDraft";

/**
 * Excel in and out of the Bulk Upload table. The first sheet of a file is the table: row 1 holds the column labels of the open tab, every row
 * below is one record, written as the person sees it in the table (names, not record ids). Reading only fills cells; the cells are then checked by the
 * tab's own rules (bulkSpecs `check`) like any typed row, and nothing here talks to the server. No password, token or id is ever written.
 */
const FILE_NAMES: Record<BulkType, string> = { backlog: "bulk-backlog", owner: "bulk-owners", users: "bulk-team-members" };
const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500; // the same cap as a stored draft
const TEMPLATE_ROWS = 200; // rows of the template that offer their dropdowns
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The columns that go to and from a file (a fixed read-only column such as the Backlog Status is not data). */
const columnsOf = (type: BulkType) => BULK_SPECS[type].columns.filter((c) => c.excel !== false);

const norm = (s: string) => s.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

async function newWorkbook() {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

function save(buffer: ArrayBuffer, name: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_TYPE }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A cell's stored value as the text a person reads in Excel. */
function toCell(c: Column, type: BulkType, values: Values, ctx: Ctx): string {
  const v = values[c.key] ?? "";
  if (c.control === "pick") return resolveOne(choicesOf(c, ctx), v)?.label ?? v;
  if (c.control === "multi") return tokens(v).map((t) => resolveOne(choicesOf(c, ctx), t)?.label ?? t).join(", ");
  void type;
  return v;
}

const choicesOf = (c: Column, ctx: Ctx): PickOptionData[] => (c.options?.(ctx) ?? []) as PickOptionData[];

function sheetOf(wb: Awaited<ReturnType<typeof newWorkbook>>, name: string, type: BulkType, ctx: Ctx, bodyRows: string[][], withLists: boolean) {
  const cols = columnsOf(type);
  const ws = wb.addWorksheet(name);
  ws.columns = cols.map((c) => ({ header: c.required ? `${c.label} *` : c.label, key: c.key, width: Math.max(14, Math.round(c.width / 7)) }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  bodyRows.forEach((r) => ws.addRow(r));
  cols.forEach((c, i) => {
    if (c.control === "date") ws.getColumn(i + 1).numFmt = "yyyy-mm-dd";
  });
  if (withLists) {
    cols.forEach((c, i) => {
      if (c.control !== "select") return;
      const list = (c.options?.(ctx) ?? []).map((o: Option) => o.label);
      const formula = `"${list.join(",")}"`;
      if (list.some((l) => l.includes(",") || l.includes('"')) || formula.length > 255) return;
      for (let r = 2; r <= TEMPLATE_ROWS + 1; r++) ws.getCell(r, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
    });
  }
  return ws;
}

/** Example cells for the sample sheet, from the tab's own options (so the sample is itself a valid row). */
function sample(type: BulkType, ctx: Ctx): string[] {
  const first = (c: Column) => c.options?.(ctx).find((o) => o.value && o.value !== "Not set")?.label ?? "";
  return columnsOf(type).map((c) => {
    if (c.control === "select") return first(c);
    if (c.control === "date") return todayISO();
    if (c.control === "pick" || c.control === "multi") return "";
    if (c.key === "title") return "Example backlog item";
    if (c.key === "email") return `example.person@${ALLOWED_EMAIL_DOMAIN}`;
    if (c.key === "name") return type === "owner" ? "Example Owner" : "Example Person";
    if (c.key === "team") return "Example Team";
    return c.key === "description" || c.key === "notes" ? "Optional text" : "";
  });
}

/** A template for the tab: the header row (sheet 1, ready to fill in) and a clearly marked sample row that is not part of the import. */
export async function downloadTemplate(type: BulkType, ctx: Ctx) {
  const wb = await newWorkbook();
  const spec = BULK_SPECS[type];
  sheetOf(wb, spec.label, type, ctx, [], true);
  const ex = sheetOf(wb, "Sample (not imported)", type, ctx, [sample(type, ctx)], false);
  ex.addRow([]);
  ex.addRow([`SAMPLE DATA. Fill in the first sheet (${spec.label}); only that sheet is imported. * marks a required column.`]);
  const notes = columnsOf(type).flatMap((c) => (c.control === "pick" || c.control === "multi" ? [`${c.label}: use the name of an existing ${c.control === "pick" && c.key === "owner" ? "owner" : "team member"}${c.control === "multi" ? " (separate several with commas)" : ""}.`] : c.control === "date" ? [`${c.label}: use YYYY-MM-DD.`] : []));
  notes.forEach((n) => ex.addRow([n]));
  save(await wb.xlsx.writeBuffer(), `${FILE_NAMES[type]}-template`);
}

/** The tab's entered rows (the caller leaves out the empty spare row) as they are now, edits and mistakes included. */
export async function downloadRows(type: BulkType, rows: readonly Values[], ctx: Ctx) {
  const wb = await newWorkbook();
  const cols = columnsOf(type);
  sheetOf(wb, BULK_SPECS[type].label, type, ctx, rows.filter((v) => !isBlankValues(type, v)).map((v) => cols.map((c) => toCell(c, type, v, ctx))), false);
  save(await wb.xlsx.writeBuffer(), FILE_NAMES[type]);
}

/** What a cell holds, as plain text (Excel gives numbers, dates, rich text, formula results, links...). */
function textOf(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown; error?: unknown };
    if (o.error) return "";
    if (o.richText) return o.richText.map((p) => p.text).join("").trim();
    if (o.result !== undefined) return textOf(o.result);
    if (o.text !== undefined) return textOf(o.text);
    return "";
  }
  return String(v).trim();
}

export class ExcelImportError extends Error {}

/** Reads a file into rows of cell values for the tab. Throws ExcelImportError (with a message to show) when the file cannot be used. */
export async function readRows(file: File, type: BulkType, ctx: Ctx): Promise<Values[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new ExcelImportError("Choose an Excel file (.xlsx). Download the template to see the layout.");
  if (file.size > MAX_FILE_BYTES) throw new ExcelImportError("This file is larger than 5 MB.");
  const wb = await newWorkbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new ExcelImportError("This file could not be read. Check that it is a valid .xlsx file.");
  }
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount === 0) throw new ExcelImportError("The file is empty.");

  const cols = columnsOf(type);
  const byHeader = new Map(cols.map((c) => [norm(c.label), c]));
  const at = new Map<number, Column>(); // sheet column number -> table column
  const unknown: string[] = [];
  ws.getRow(1).eachCell((cell, n) => {
    const h = textOf(cell.value);
    if (!h) return;
    const c = byHeader.get(norm(h));
    if (c && ![...at.values()].includes(c)) at.set(n, c);
    else unknown.push(h);
  });
  if (unknown.length) throw new ExcelImportError(`Unsupported column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Use the columns of the ${BULK_SPECS[type].label} template: ${cols.map((c) => c.label).join(", ")}.`);
  const missing = cols.filter((c) => c.required && ![...at.values()].includes(c)).map((c) => c.label);
  if (missing.length) throw new ExcelImportError(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);

  const out: Values[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values: Values = { ...BULK_SPECS[type].blank() };
    let any = false;
    at.forEach((c, n) => {
      const text = textOf(row.getCell(n).value);
      if (!text) return;
      any = true;
      values[c.key] = fromText(c, text, ctx);
    });
    if (!any) continue;
    for (const c of cols) if (c.readOnly?.(ctx, values)) values[c.key] = BULK_SPECS[type].blank()[c.key] ?? ""; // a locked cell keeps its fixed value
    out.push(values);
    if (out.length > MAX_IMPORT_ROWS) throw new ExcelImportError(`The file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`);
  }
  if (out.length === 0) throw new ExcelImportError("The file has a header row but no records.");
  return out;
}

/** A cell's text as the table stores it: a choice becomes its option / record, anything unrecognised is kept as typed so the check marks it. */
function fromText(c: Column, text: string, ctx: Ctx): string {
  if (c.control === "pick") return resolveOne(choicesOf(c, ctx), text)?.value ?? text;
  if (c.control === "multi") return tokens(text).map((t) => resolveOne(choicesOf(c, ctx), t)?.value ?? t).join(",");
  if (c.control === "select") {
    const hit = (c.options?.(ctx) ?? []).find((o: Option) => norm(o.label) === norm(text) || norm(o.value) === norm(text));
    return hit?.value ?? text;
  }
  return c.format ? c.format(text) : text; // an imported address is kept as written (validation still completes a bare name)
}
