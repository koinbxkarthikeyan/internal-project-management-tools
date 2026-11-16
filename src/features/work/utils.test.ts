import { describe, expect, it } from "vitest";
import { eachDay, hoursStanding, isWeekend, percentOfTotal, plannedHours, recentSprints, sprintHours, workingDays, type OffDays } from "./utils";

// November 2026: Mon 2 ... Fri 6, Sat 7, Sun 8, Mon 9 ... Fri 13, Sat 14, Sun 15.
const WEEK = ["2026-11-02", "2026-11-08"] as const;
const SPRINT = { id: "1", start: "2026-11-02", end: "2026-11-15" };
const off = (entries: [string, number][]): OffDays => new Map(entries);

describe("days", () => {
  it("lists every calendar day, inclusive", () => {
    expect(eachDay("2026-11-02", "2026-11-04")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(eachDay("2026-11-05", "2026-11-04")).toEqual([]);
    expect(eachDay("", "2026-11-04")).toEqual([]);
  });

  it("knows the weekend", () => {
    expect(isWeekend("2026-11-07")).toBe(true);
    expect(isWeekend("2026-11-08")).toBe(true);
    expect(isWeekend("2026-11-09")).toBe(false);
  });
});

describe("planned hours and working days", () => {
  it("is 6 hours for each weekday", () => {
    expect(plannedHours(...WEEK)).toBe(30);
    expect(workingDays(...WEEK)).toBe(5);
  });

  it("takes a full leave day out completely", () => {
    const leave = off([["2026-11-04", 6]]);
    expect(plannedHours(...WEEK, leave)).toBe(24);
    expect(workingDays(...WEEK, leave)).toBe(4);
  });

  it("takes only the hours off of a part day, which is still a working day", () => {
    const leave = off([["2026-11-04", 2]]);
    expect(plannedHours(...WEEK, leave)).toBe(28);
    expect(workingDays(...WEEK, leave)).toBe(5);
  });

  it("never goes below zero and ignores leave on a weekend", () => {
    expect(plannedHours(...WEEK, off([["2026-11-04", 9]]))).toBe(24);
    expect(plannedHours(...WEEK, off([["2026-11-07", 6]]))).toBe(30);
  });
});

describe("sprint hours", () => {
  it("is 60 hours for a two-week sprint, and none so far before it starts", () => {
    expect(sprintHours([SPRINT], "2026-10-30")).toEqual({ soFar: 0, total: 60 });
  });

  it("counts the days so far, today included, and stops at the sprint's end", () => {
    expect(sprintHours([SPRINT], "2026-11-04").soFar).toBe(18);
    expect(sprintHours([SPRINT], "2026-12-31").soFar).toBe(60);
  });

  it("uses the person's leave for that sprint", () => {
    const offFor = (id: string) => (id === "1" ? off([["2026-11-03", 6], ["2026-11-10", 3]]) : off([]));
    expect(sprintHours([SPRINT], "2026-12-31", offFor)).toEqual({ soFar: 51, total: 51 });
    expect(sprintHours([SPRINT], "2026-11-04", offFor).soFar).toBe(12); // Mon 2, Wed 4 (Tue is leave)
  });
});

describe("standing and share", () => {
  it("says where logged hours stand", () => {
    expect(hoursStanding(10, 18, 60).tone).toBe("below");
    expect(hoursStanding(18, 18, 60).label).toBe("on target");
    expect(hoursStanding(30, 18, 60).tone).toBe("above");
    expect(hoursStanding(70, 18, 60).tone).toBe("over");
  });

  it("is a share of the whole sprint, 0 when it has no hours", () => {
    expect(percentOfTotal(30, 60)).toBe(50);
    expect(percentOfTotal(5, 0)).toBe(0);
  });
});

describe("recent sprints", () => {
  const s = (id: string, start: string, status = "Closed") => ({ id, start, end: start, status });
  it("is the running sprint and the two before it, oldest first", () => {
    const all = [s("1", "2026-09-01"), s("2", "2026-10-01"), s("3", "2026-11-01", "Active"), s("4", "2026-12-01", "Planned")];
    expect(recentSprints(all).map((x) => x.id)).toEqual(["1", "2", "3"]);
  });
});
