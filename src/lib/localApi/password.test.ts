import { describe, expect, it } from "vitest";
import { SUBTLE_ROUNDS, hashPassword, passwordNeedsUpgrade, verifyPassword } from "./password";

describe("passwords", () => {
  it("hashes with 600,000 PBKDF2 rounds and checks the right password only", async () => {
    expect(SUBTLE_ROUNDS).toBe(600_000);
    const record = await hashPassword("Correct Horse 9!");
    expect(record).toMatchObject({ engine: "subtle", iterations: 600_000 });
    expect(await verifyPassword("Correct Horse 9!", record)).toBe(true);
    expect(await verifyPassword("correct horse 9!", record)).toBe(false);
  }, 20_000);

  it("never stores the password, and gives two hashes of one password different salts", async () => {
    const a = await hashPassword("Same@Password1");
    const b = await hashPassword("Same@Password1");
    expect(JSON.stringify(a)).not.toContain("Same@Password1");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  }, 20_000);

  it("marks an older, weaker hash to be rebuilt at the next sign-in", async () => {
    const fresh = await hashPassword("Another@Pass1");
    expect(passwordNeedsUpgrade(fresh)).toBe(false);
    expect(passwordNeedsUpgrade({ ...fresh, iterations: 150_000 })).toBe(true);
    expect(passwordNeedsUpgrade({ ...fresh, engine: "js", iterations: 15_000 })).toBe(true);
  }, 20_000);
});
