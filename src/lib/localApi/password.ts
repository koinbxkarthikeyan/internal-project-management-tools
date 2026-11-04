/**
 * Password hashing for the sign-in kept in this browser: a random salt and PBKDF2-SHA256. The password itself is never stored.
 * WebCrypto only exists on https:// and localhost; on a plain http:// address the same algorithm runs in JavaScript with fewer rounds
 * (the record says which, so it is verified the way it was made).
 */
export type PasswordRecord = { salt: string; hash: string; iterations: number; engine: "subtle" | "js" };

const SUBTLE_ROUNDS = 150_000;
const JS_ROUNDS = 15_000;

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));

// ---------- SHA-256 / HMAC / PBKDF2 in plain JavaScript (the fallback) ----------
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const padded = new Uint8Array((((data.length + 9 + 63) >> 6) << 6));
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, (data.length * 8) >>> 0);
  view.setUint32(padded.length - 8, Math.floor((data.length * 8) / 2 ** 32));
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  h.forEach((v, i) => ov.setUint32(i * 4, v));
  return out;
}

function hmac(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = key.length > 64 ? sha256(key) : key;
  const inner = new Uint8Array(64 + msg.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    inner[i] = (k[i] ?? 0) ^ 0x36;
    outer[i] = (k[i] ?? 0) ^ 0x5c;
  }
  inner.set(msg, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}

function pbkdf2Js(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  const first = new Uint8Array(salt.length + 4);
  first.set(salt);
  first[salt.length + 3] = 1;
  let u = hmac(password, first);
  const t = Uint8Array.from(u);
  for (let i = 1; i < iterations; i++) {
    u = hmac(password, u);
    for (let j = 0; j < 32; j++) t[j] ^= u[j];
  }
  return t;
}

async function derive(password: string, salt: Uint8Array, iterations: number, engine: PasswordRecord["engine"]): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  if (engine === "subtle") {
    const key = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
    return hex(new Uint8Array(bits));
  }
  return hex(pbkdf2Js(bytes, salt, iterations));
}

const subtleAvailable = () => typeof crypto !== "undefined" && !!crypto.subtle;

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const engine: PasswordRecord["engine"] = subtleAvailable() ? "subtle" : "js";
  const iterations = engine === "subtle" ? SUBTLE_ROUNDS : JS_ROUNDS;
  return { salt: hex(salt), hash: await derive(password, salt, iterations, engine), iterations, engine };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  // A record made with WebCrypto can only be checked where WebCrypto exists (the same address it was made on).
  if (record.engine === "subtle" && !subtleAvailable()) return false;
  const hash = await derive(password, fromHex(record.salt), record.iterations, record.engine);
  let diff = hash.length ^ record.hash.length;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ (record.hash.charCodeAt(i) || 0);
  return diff === 0;
}
