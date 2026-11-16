import fs from "node:fs";
import path from "node:path";

const NAME = /^db-(\d{4}-\d{2}-\d{2})\.json$/;

/**
 * The daily safety copy of the database: the first time the data is saved on a new day, that text is written as `db-YYYY-MM-DD.json` in `dir`, and only the newest `keep` copies stay.
 * Nothing but files with that exact name is ever listed or deleted. Returns the file written, or `null` when today already has its copy. Throws if it can't write; the caller must
 * never let that stop a save.
 */
export function dailyBackup(text: string, { dir, day, keep }: { dir: string; day: string; keep: number }): string | null {
  const file = path.join(dir, `db-${day}.json`);
  if (fs.existsSync(file)) return null;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
  const copies = fs.readdirSync(dir).filter((n) => NAME.test(n)).sort().reverse();
  for (const old of copies.slice(Math.max(1, keep))) fs.rmSync(path.join(dir, old), { force: true });
  return file;
}
