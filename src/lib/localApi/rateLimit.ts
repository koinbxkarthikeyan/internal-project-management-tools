/**
 * A limit on wrong sign-in passwords from one address, on top of the lock on each account (5 wrong passwords lock that account for 5 minutes). It stops someone trying one
 * password on every account. Kept in memory: a restart clears it, which is fine for a limit that lasts minutes.
 *
 * The address comes from the proxy in front of the app (`x-forwarded-for` / `x-real-ip`); the proxy must set it, or anyone can fake it. With no proxy there is no address and every
 * request counts as one ("direct"), so the limit is then shared.
 */
export const FAILURES_ALLOWED = 20;
export const WINDOW_MS = 10 * 60_000;

type Bucket = { failures: number[] };
const g = globalThis as { __koinbxSignInFailures?: Map<string, Bucket> };
const buckets = () => (g.__koinbxSignInFailures ??= new Map());

const recent = (b: Bucket, now: number) => b.failures.filter((t) => now - t < WINDOW_MS);

/** Minutes left to wait, or 0 when this address may try. */
export function waitMinutes(ip: string, now = Date.now()): number {
  const b = buckets().get(ip);
  if (!b) return 0;
  const failures = recent(b, now);
  if (failures.length < FAILURES_ALLOWED) return 0;
  return Math.max(1, Math.ceil((failures[0] + WINDOW_MS - now) / 60_000));
}

export function recordFailure(ip: string, now = Date.now()) {
  const map = buckets();
  const b = map.get(ip) ?? { failures: [] };
  b.failures = [...recent(b, now), now];
  map.set(ip, b);
  // Addresses that stopped trying are forgotten.
  if (map.size > 5000) for (const [key, v] of map) if (recent(v, now).length === 0) map.delete(key);
}

export const resetLimits = () => buckets().clear();

/** The address of a request, from the proxy's headers. */
export function clientAddress(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "direct";
}
