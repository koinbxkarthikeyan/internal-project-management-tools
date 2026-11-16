import { describe, expect, it } from "vitest";
import { offDaysOf, type PersonalLeave } from "./leaveStore";

const mine = (date: string, hours?: number, sprintId = "1", userId = "7"): PersonalLeave => ({ id: `${userId}-${date}`, sprintId, userId, date, ...(hours ? { hours } : {}) });

describe("offDaysOf", () => {
  it("makes a common leave day a whole day off for everyone", () => {
    expect([...offDaysOf([{ date: "2026-11-04" }], [], "1", "7")]).toEqual([["2026-11-04", 6]]);
    expect(offDaysOf([{ date: "2026-11-04" }], [], "1").get("2026-11-04")).toBe(6);
  });

  it("gives a personal leave day its hours, or a whole day when none are given", () => {
    const off = offDaysOf([], [mine("2026-11-05", 2), mine("2026-11-06")], "1", "7");
    expect(off.get("2026-11-05")).toBe(2);
    expect(off.get("2026-11-06")).toBe(6);
  });

  it("takes the larger of common and personal for one date, never more than a day", () => {
    const off = offDaysOf([{ date: "2026-11-05" }], [mine("2026-11-05", 2), mine("2026-11-09", 20)], "1", "7");
    expect(off.get("2026-11-05")).toBe(6);
    expect(off.get("2026-11-09")).toBe(6);
  });

  it("leaves out another person's leave and another sprint's leave", () => {
    const off = offDaysOf([], [mine("2026-11-05", 2, "1", "8"), mine("2026-11-06", 2, "2", "7")], "1", "7");
    expect(off.size).toBe(0);
    expect(offDaysOf([], [mine("2026-11-05", 2)], "1").size).toBe(0); // no person given: only common leave counts
  });
});
