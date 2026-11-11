/** Which pages each single-key shortcut belongs to (a key only works, and its hint only shows, where it is needed). */
const at = (pathname: string, ...pages: string[]) => pages.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * B: every page except Bulk Upload, the Personal Overview (`?view=mine`) and the Work & Team pages (Log Work, Team Work Details, Your Logged Work, My Task).
 * The Team Overview (the Overview's default tab) has it.
 */
export const canPressB = (pathname: string, view?: string | null) => !at(pathname, "/bulk-upload", "/my-sprint", "/my-task") && !(at(pathname, "/overview") && view === "mine");
/** The pages with a search box (the Sprint plan has its own search form over every task). */
export const hasSearch = (pathname: string) => at(pathname, "/all-items", "/backlog", "/users", "/owners-sprints", "/sprint-plan");
/** O: the Owners & sprints page (admins). */
export const canPressO = (pathname: string) => at(pathname, "/owners-sprints");
/** T: the Team Members page (admins). */
export const canPressT = (pathname: string) => at(pathname, "/users");
/** 1 2 3 pick a tab, on every page that has a row of tabs (the Personal Overview and the pages of a Team Member that have none are not listed). */
export const hasTabs = (pathname: string, restricted: boolean) =>
  at(pathname, "/sprint-plan", "/my-task", "/my-sprint/logged", "/my-sprint/team", "/all-items", "/bulk-upload") || (at(pathname, "/overview") && !restricted);
/** A (add row), S (Auto-Save), U (upload Excel), D (download template): the Bulk Upload page. */
export const canPressBulk = (pathname: string) => at(pathname, "/bulk-upload");
/** S: the Sprint plan page. */
export const canPressS = (pathname: string) => at(pathname, "/sprint-plan");
