import { describe, expect, it } from "vitest";
import { canPressB, canPressBulk, canPressO, canPressS, canPressT, hasSearch, hasTabs, hasTaskDetails, hasTaskRows } from "./shortcuts";

describe("which keys work where", () => {
  it("B creates a backlog item on most pages, but not on Bulk Upload, Log Work, My Task or the personal overview", () => {
    expect(canPressB("/backlog")).toBe(true);
    expect(canPressB("/all-items")).toBe(true);
    expect(canPressB("/overview")).toBe(true);
    expect(canPressB("/overview", "mine")).toBe(false);
    for (const page of ["/bulk-upload", "/my-sprint", "/my-sprint/logged", "/my-task", "/my-task/task"]) expect(canPressB(page)).toBe(false);
  });

  it("O and T are for their own pages only", () => {
    expect(canPressO("/owners-sprints")).toBe(true);
    expect(canPressO("/users")).toBe(false);
    expect(canPressT("/users")).toBe(true);
    expect(canPressT("/backlog")).toBe(false);
  });

  it("S and the bulk keys belong to Sprint Plan and Bulk Upload", () => {
    expect(canPressS("/sprint-plan")).toBe(true);
    expect(canPressS("/backlog")).toBe(false);
    expect(canPressBulk("/bulk-upload")).toBe(true);
    expect(canPressBulk("/sprint-plan")).toBe(false);
  });

  it("search, tabs and the arrow keys are listed for the right pages", () => {
    expect(hasSearch("/users")).toBe(true);
    expect(hasSearch("/overview")).toBe(false);
    expect(hasTabs("/sprint-plan", false)).toBe(true);
    expect(hasTabs("/overview", true)).toBe(false);
    expect(hasTaskDetails("/qa-workspace/task")).toBe(true);
    expect(hasTaskDetails("/qa-workspace")).toBe(false);
    expect(hasTaskRows("/my-task")).toBe(true);
  });
});
