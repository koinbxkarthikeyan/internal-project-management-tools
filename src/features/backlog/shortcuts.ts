/** Which pages each single-key shortcut belongs to (a key only works, and its hint only shows, where it is needed). */
const at = (pathname: string, ...pages: string[]) => pages.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * B: every page except Bulk Upload, the Personal Overview (`?view=mine`) and the Work & Team pages (Log Work, Team Work Details, Your Logged Work, My Task).
 * The Team Overview (the Overview's default tab) has it.
 */
export const canPressB = (pathname: string, view?: string | null) => !at(pathname, "/bulk-upload", "/my-sprint", "/my-task") && !(at(pathname, "/overview") && view === "mine");
/** O: the Owners & sprints page (admins). */
export const canPressO = (pathname: string) => at(pathname, "/owners-sprints");
/** T: the Team Members page (admins). */
export const canPressT = (pathname: string) => at(pathname, "/users");
/** S: the Sprint plan page. */
export const canPressS = (pathname: string) => at(pathname, "/sprint-plan");
