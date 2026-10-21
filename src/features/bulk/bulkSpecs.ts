import { ALLOWED_EMAIL_DOMAIN, DEFAULT_INITIAL_PASSWORD, TEAM_MAX_LENGTH } from "@/constants/auth";
import { ITEM_TYPES, PRIORITIES } from "@/constants/backlog-options";
import { cleanAssignees } from "@/features/backlog/components/AssigneeField";
import { todayISO } from "@/features/backlog/utils";
import { completeEmail, completeWhileTyping, validateEmail } from "@/lib/auth/emailRules";
import { cleanTeam } from "@/lib/auth/teams";
import * as backlogService from "@/services/backlogService";
import * as userService from "@/services/userService";
import type { AppUser, AssignableRole, AccessStatus } from "@/types/auth";
import type { ItemType, Owner, Priority } from "@/types/backlog";

/**
 * What each upload type is made of: its columns (the same labels, options and rules as the Create backlog, Create owner and
 * Add Team Member forms), how a row is checked, and the record a valid row becomes in the tab's bulk request (src/services/bulkService.ts).
 */
export type BulkType = "backlog" | "owner" | "users";
export type Option = { value: string; label: string };
export type Values = Record<string, string>;
export type Row = { id: string; values: Values };
export type Problems = Record<string, string>;

/** What the checks and the dropdowns need from the app's current data. */
export type Ctx = {
  owners: string[];
  ownerRecords: readonly Owner[];
  users: readonly AppUser[];
  sprintOptions: Option[];
  teams: string[];
  ownerTeams: string[];
  isSuperAdmin: boolean;
};

export type Column = {
  key: string;
  label: string;
  control: "text" | "select" | "date" | "pick" | "multi";
  /** For a `pick` / `multi` column: the existing record a "+ Create New …" action in its list adds (the same forms as in Create backlog). */
  create?: "owner" | "member";
  required?: boolean;
  /** Pixel width of the column. */
  width: number;
  placeholder?: string;
  options?: (ctx: Ctx) => Option[];
  suggestions?: (ctx: Ctx) => string[];
  /** What an optional dropdown shows when nothing is chosen (default "—"). */
  emptyLabel?: string;
  /** `false`: not part of an Excel file (a fixed value, not data). */
  excel?: false;
  /** A column that can't be changed in this row (shows its fixed value). */
  readOnly?: (ctx: Ctx, values: Values) => boolean;
  /** Normalises what is typed (e.g. capitalising a name). */
  format?: (value: string) => string;
  /** Adjusts what is typed or pasted, given the previous text (e.g. a just-typed "@" after a name gets the company domain). */
  typing?: (previous: string, next: string) => string;
  /** Completes the value when the cell is left (e.g. `name` becomes `name@koinbx.com`, as the Email field does). */
  complete?: (value: string) => string;
};

export type BulkSpec = {
  label: string;
  hint: string;
  columns: Column[];
  blank: () => Values;
  /** Problems of one row by column key; `rows` is the whole table (for repeats within it). */
  check: (row: Row, rows: readonly Row[], ctx: Ctx) => Problems;
  /** The request record for one valid row: exactly what the matching single-create call sends. Throws an Error saying why it cannot be built. */
  toBody: (values: Values, ctx: Ctx) => unknown;
};

const REQUIRED = (label: string) => `${label} is required.`;
const lower = (v: string) => v.trim().toLowerCase();
const options = (list: readonly string[]): Option[] => list.map((v) => ({ value: v, label: v }));
export type PickOptionData = { value: string; label: string; hint?: string };

/** The options an Owner / Lead / Team Members cell offers, with the record's id as the value. */
export const ownerChoices = (c: Ctx): PickOptionData[] =>
  c.ownerRecords.filter((o) => o.name !== "Unassigned").map((o) => ({ value: o.id, label: o.name, hint: [o.role, o.team].filter(Boolean).join(" · ") || undefined }));
export const memberChoices = (c: Ctx): PickOptionData[] => {
  const seen = new Set<string>();
  return c.users.filter((u) => !seen.has(u.id) && seen.add(u.id)).map((u) => ({ value: u.id, label: u.name, hint: u.email }));
};
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** The option a stored value points at: by id, or (for a draft saved before ids were kept) by name. */
export const resolveOne = (choices: readonly PickOptionData[], value: string): PickOptionData | undefined =>
  value.trim() ? (choices.find((o) => o.value === value.trim()) ?? choices.find((o) => same(o.label, value))) : undefined;
export const tokens = (value: string): string[] => [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))];

const titleCase = (v: string) => v.replace(/\s{2,}/g, " ").replace(/^\s+/, "").replace(/(^|\s)(\S)/g, (_, space: string, c: string) => space + c.toUpperCase());
const clean = (v: string) => v.replace(/\s+/g, " ").trim();
const repeats = (rows: readonly Row[], key: string, value: string, id: string, norm: (v: string) => string) =>
  value.trim() !== "" && rows.some((r) => r.id !== id && norm(r.values[key] ?? "") === norm(value));

// ---------- Backlog ----------
const UNPLANNED = "Unplanned";

const backlog: BulkSpec = {
  label: "Backlog",
  hint: "Each row creates one backlog item with the same fields and options as the Create backlog form. New items start as Backlog; the ID is given by the server. Owner, Lead and Team Members are optional here: leave them empty and nobody is assigned (the server decides whether it accepts an item without an owner).",
  columns: [
    { key: "owner", label: "Owner", control: "pick", width: 190, emptyLabel: "No owner", create: "owner", options: ownerChoices },
    { key: "title", label: "Title", control: "text", required: true, width: 220, placeholder: "Short name for the work" },
    { key: "description", label: "Description", control: "text", width: 240, placeholder: "What will change?" },
    { key: "type", label: "Type", control: "select", required: true, width: 150, options: () => options(ITEM_TYPES) },
    { key: "priority", label: "Priority", control: "select", width: 130, options: () => options(["Not set", ...PRIORITIES.filter((p) => p !== "Not set")]) },
    { key: "sprint", label: "Sprint", control: "select", required: true, width: 170, options: (c) => c.sprintOptions },
    { key: "deadline", label: "Expected deadline", control: "date", width: 160 },
    { key: "lead", label: "Lead", control: "pick", width: 190, emptyLabel: "No lead", create: "member", options: memberChoices },
    { key: "assignees", label: "Team Members", control: "multi", width: 230, emptyLabel: "No team members", create: "member", options: memberChoices },
    { key: "notes", label: "Notes", control: "text", width: 200 },
    { key: "status", label: "Status", control: "text", width: 110, excel: false, readOnly: () => true },
  ],
  blank: () => ({ priority: "Not set", status: "Backlog" }),
  check({ values: v }, _rows, c) {
    const p: Problems = {};
    // Owner, Lead and Team Members are optional in a bulk upload; whatever is chosen must still exist.
    if (v.owner && !resolveOne(ownerChoices(c), v.owner)) p.owner = "This owner no longer exists. Choose another.";
    if (!clean(v.title ?? "")) p.title = REQUIRED("Title");
    if (!v.type) p.type = REQUIRED("Type");
    else if (!ITEM_TYPES.includes(v.type as ItemType)) p.type = "Choose a listed type.";
    if (v.priority && v.priority !== "Not set" && !PRIORITIES.includes(v.priority as Priority)) p.priority = "Choose a listed priority.";
    if (!v.sprint) p.sprint = REQUIRED("Sprint");
    else if (!c.sprintOptions.some((o) => o.value === v.sprint)) p.sprint = "Choose a listed sprint.";
    if (v.deadline && Number.isNaN(Date.parse(`${v.deadline}T00:00:00Z`))) p.deadline = "Enter a valid date.";
    if (v.lead && !resolveOne(memberChoices(c), v.lead)) p.lead = "This user is no longer registered. Choose another.";
    const people = memberChoices(c);
    const gone = tokens(v.assignees ?? "").filter((t) => !resolveOne(people, t));
    if (gone.length) p.assignees = `Not registered any more: ${gone.join(", ")}. Remove them.`;
    return p;
  },
  toBody(v, c) {
    // The cells keep record ids; the body is built from their names (turned back into ids), as the Create backlog form's own call does.
    const ownerName = resolveOne(ownerChoices(c), v.owner ?? "")?.label;
    const leadName = resolveOne(memberChoices(c), v.lead ?? "")?.label;
    const memberNames = tokens(v.assignees ?? "").flatMap((t) => resolveOne(memberChoices(c), t)?.label ?? []);
    return backlogService.newItemBody({
      title: clean(v.title),
      owner: ownerName ?? "Unassigned", // no owner chosen: the record carries no ownerId (the server accepts or refuses it)
      priority: (v.priority || "Not set") as Priority,
      type: v.type as ItemType,
      status: "Open",
      sprint: v.sprint === UNPLANNED ? UNPLANNED : v.sprint,
      deadline: v.deadline ?? "",
      comments: 0,
      description: v.description ?? "",
      ...(leadName ? { lead: leadName } : {}),
      assignees: cleanAssignees(memberNames.join(", ")),
      notes: v.notes ?? "",
      created: todayISO(),
      activity: [{ date: todayISO(), text: "Created" }],
    });
  },
};

// ---------- Owner ----------
const owner: BulkSpec = {
  label: "Owner",
  hint: "Each row creates one owner (an owner is a record of its own, not a user). Team is optional.",
  columns: [
    { key: "name", label: "Name", control: "text", required: true, width: 240, placeholder: "e.g. Jordan Blake" },
    { key: "team", label: "Team", control: "text", width: 220, suggestions: (c) => c.ownerTeams },
  ],
  blank: () => ({}),
  check(row, rows, c) {
    const v = row.values;
    const p: Problems = {};
    const name = clean(v.name ?? "");
    if (!name) p.name = REQUIRED("Name");
    else if (name.toLowerCase() === "unassigned" || c.owners.some((o) => lower(o) === lower(name))) p.name = `An owner named ${name} already exists.`;
    else if (repeats(rows, "name", name, row.id, (x) => lower(clean(x)))) p.name = "This name is repeated in the table.";
    return p;
  },
  toBody(v) {
    const team = clean(v.team ?? "");
    return { name: clean(v.name), ...(team ? { team } : {}) };
  },
};

// ---------- Users ----------
const ROLES: AssignableRole[] = ["Admin", "User"];

const users: BulkSpec = {
  label: "Team Member",
  hint: `Each row adds one team member, as Add Team Member does (only @${ALLOWED_EMAIL_DOMAIN} addresses). No password is entered or shown here; new accounts get the standard initial password and Users sign in with an emailed code.`,
  columns: [
    { key: "name", label: "Name", control: "text", required: true, width: 220, format: titleCase, placeholder: "e.g. Jordan Blake" },
    { key: "email", label: "Email", control: "text", required: true, width: 250, placeholder: `name@${ALLOWED_EMAIL_DOMAIN}`, format: (v) => v.toLowerCase(), typing: completeWhileTyping, complete: (v) => completeEmail(v).toLowerCase() },
    { key: "role", label: "Role", control: "select", required: true, width: 130, options: () => options(ROLES) },
    { key: "team", label: "Team", control: "text", width: 200, suggestions: (c) => c.teams },
    {
      key: "status",
      label: "Account status",
      control: "select",
      width: 150,
      options: () => options(["Enabled", "Disabled"]),
      // Only the Super Admin chooses, and only for Admin accounts; every other new account is Enabled (as in the Add Team Member form).
      readOnly: (c, v) => !(c.isSuperAdmin && v.role === "Admin"),
    },
  ],
  blank: () => ({ role: "User", status: "Enabled" }),
  check(row, rows, c) {
    const v = row.values;
    const p: Problems = {};
    if (!clean(v.name ?? "")) p.name = REQUIRED("Name");
    if (!v.email?.trim()) p.email = REQUIRED("Email");
    else {
      const checked = validateEmail(v.email);
      if (!checked.ok) p.email = checked.message.replace("can sign in", "can be added");
      else if (c.users.some((u) => lower(u.email) === checked.email)) p.email = "A user with this email is already registered.";
      else if (repeats(rows, "email", checked.email, row.id, validateEmailKey)) p.email = "This email is repeated in the table.";
    }
    if (!v.role) p.role = REQUIRED("Role");
    else if (!ROLES.includes(v.role as AssignableRole)) p.role = "Choose Admin or User.";
    if (v.team && cleanTeam(v.team).length > TEAM_MAX_LENGTH) p.team = `At most ${TEAM_MAX_LENGTH} characters.`;
    return p;
  },
  toBody(v, c) {
    const checked = validateEmail(v.email);
    if (!checked.ok) throw new Error(checked.message);
    const role = v.role as AssignableRole;
    const status: AccessStatus = c.isSuperAdmin && role === "Admin" && v.status === "Disabled" ? "Disabled" : "Enabled";
    const team = cleanTeam(v.team ?? "");
    return userService.newUserBody({ name: clean(v.name), email: checked.email, role, status, ...(team ? { team } : {}), password: DEFAULT_INITIAL_PASSWORD });
  },
};
const validateEmailKey = (x: string) => {
  const r = validateEmail(x);
  return r.ok ? r.email : lower(x);
};

export const BULK_SPECS: Record<BulkType, BulkSpec> = { backlog, owner, users };
export const BULK_TYPES: { value: BulkType; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "owner", label: "Owner" },
  { value: "users", label: "Team Member" },
];
