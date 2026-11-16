import { beforeEach, describe, expect, it } from "vitest";
import { FAILURES_ALLOWED, WINDOW_MS, clientAddress, recordFailure, resetLimits, waitMinutes } from "./rateLimit";

beforeEach(resetLimits);

describe("sign-in limit per address", () => {
  it("lets an address try until it has failed too often", () => {
    for (let i = 0; i < FAILURES_ALLOWED - 1; i++) recordFailure("1.2.3.4", 1000);
    expect(waitMinutes("1.2.3.4", 1000)).toBe(0);
    recordFailure("1.2.3.4", 1000);
    expect(waitMinutes("1.2.3.4", 1000)).toBeGreaterThan(0);
  });

  it("counts each address on its own", () => {
    for (let i = 0; i < FAILURES_ALLOWED; i++) recordFailure("1.2.3.4", 1000);
    expect(waitMinutes("5.6.7.8", 1000)).toBe(0);
  });

  it("lets the address back in once the failures are old enough", () => {
    for (let i = 0; i < FAILURES_ALLOWED; i++) recordFailure("1.2.3.4", 1000);
    expect(waitMinutes("1.2.3.4", 1000 + WINDOW_MS + 1)).toBe(0);
  });
});

describe("clientAddress", () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k] ?? null });
  it("takes the first address the proxy passed on, else the real-ip header, else 'direct'", () => {
    expect(clientAddress(headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientAddress(headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientAddress(headers({}))).toBe("direct");
  });
});
