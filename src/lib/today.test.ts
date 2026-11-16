import { afterEach, describe, expect, it } from "vitest";
import { todayISO } from "./today";

// Clocks used below, all on 14 November 2026 in India (IST, UTC+5:30).
const IST_0030 = new Date("2026-11-13T19:00:00Z"); // 00:30 IST on the 14th: UTC still says the 13th
const IST_0500 = new Date("2026-11-13T23:30:00Z"); // 05:00 IST on the 14th
const IST_2330 = new Date("2026-11-14T18:00:00Z"); // 23:30 IST on the 14th

describe("todayISO", () => {
  afterEach(() => {
    delete process.env.KOINBX_TIMEZONE;
  });

  it("is the calendar day in India, not in UTC, just after midnight", () => {
    expect(todayISO(IST_0030, "Asia/Kolkata")).toBe("2026-11-14");
    expect(IST_0030.toISOString().slice(0, 10)).toBe("2026-11-13"); // what the old code used
  });

  it("is still the 14th at 05:00 and at 23:30 IST", () => {
    expect(todayISO(IST_0500, "Asia/Kolkata")).toBe("2026-11-14");
    expect(todayISO(IST_2330, "Asia/Kolkata")).toBe("2026-11-14");
  });

  it("follows KOINBX_TIMEZONE on the server", () => {
    process.env.KOINBX_TIMEZONE = "Asia/Kolkata";
    expect(todayISO(IST_0030)).toBe("2026-11-14");
    process.env.KOINBX_TIMEZONE = "UTC";
    expect(todayISO(IST_0030)).toBe("2026-11-13");
  });

  it("does not break on a misspelt zone name", () => {
    expect(todayISO(IST_0500, "Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
