import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { dailyBackup } from "./dailyBackup";

let dir: string;
beforeEach(() => {
  dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "koinbx-bk-")), "backups");
});
const names = () => fs.readdirSync(dir).sort();

describe("dailyBackup", () => {
  it("writes one copy for the day, with the text it was given", () => {
    expect(dailyBackup('{"a":1}', { dir, day: "2026-11-14", keep: 14 })).toBe(path.join(dir, "db-2026-11-14.json"));
    expect(fs.readFileSync(path.join(dir, "db-2026-11-14.json"), "utf8")).toBe('{"a":1}');
  });

  it("makes no second copy on the same day, and leaves the first one as it was", () => {
    dailyBackup("first", { dir, day: "2026-11-14", keep: 14 });
    expect(dailyBackup("second", { dir, day: "2026-11-14", keep: 14 })).toBeNull();
    expect(fs.readFileSync(path.join(dir, "db-2026-11-14.json"), "utf8")).toBe("first");
  });

  it("keeps only the newest copies", () => {
    for (const day of ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]) dailyBackup(day, { dir, day, keep: 3 });
    expect(names()).toEqual(["db-2026-11-12.json", "db-2026-11-13.json", "db-2026-11-14.json"]);
  });

  it("never deletes a file that is not one of its own copies", () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "notes.txt"), "keep me");
    fs.writeFileSync(path.join(dir, "db-latest.json"), "keep me too");
    for (const day of ["2026-11-12", "2026-11-13", "2026-11-14"]) dailyBackup(day, { dir, day, keep: 1 });
    expect(names()).toEqual(["db-2026-11-14.json", "db-latest.json", "notes.txt"]);
  });

  it("writes the copy private to its owner", () => {
    dailyBackup("x", { dir, day: "2026-11-14", keep: 14 });
    expect(fs.statSync(path.join(dir, "db-2026-11-14.json")).mode & 0o777).toBe(0o600);
  });
});
