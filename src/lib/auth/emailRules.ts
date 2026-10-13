import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const DOMAIN = ALLOWED_EMAIL_DOMAIN.toLowerCase();
const DOMAIN_TAIL = new RegExp(`(@${DOMAIN.replace(/\./g, "\\.")})+@?$`, "i");

/**
 * Completes an email with the company domain: `john` and `john@` become `john@koinbx.com`, and a partly typed domain
 * (`john@koin`) is finished. The domain is never added twice; an address with another domain is left as typed.
 */
export function completeEmail(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const at = s.indexOf("@");
  if (at === -1) return `${s}@${DOMAIN}`;
  const local = s.slice(0, at);
  if (!local) return s;
  const rest = s.slice(at + 1).replace(DOMAIN_TAIL, "").replace(/@+$/, "");
  if (rest === "" || DOMAIN.startsWith(rest.toLowerCase())) return `${local}@${DOMAIN}`;
  return `${local}@${rest}`;
}

/** Live typing: only a just-typed "@" after a name completes at once (so deleting back through the domain isn't undone). */
export function completeWhileTyping(previous: string, next: string): string {
  const at = next.indexOf("@");
  return next.length > previous.length && at > 0 && at === next.length - 1 ? `${next}${DOMAIN}` : next;
}

/** What to suggest for what is typed so far, or "" when there's nothing to add. */
export function suggestEmail(raw: string): string {
  const s = raw.trim();
  if (!s || s.startsWith("@")) return "";
  const done = completeEmail(s);
  return done.toLowerCase() === s.toLowerCase() ? "" : done;
}

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string };

/** Only well-formed addresses ending exactly in `@koinbx.com` are accepted (being valid does not grant access). */
export function validateEmail(raw: string): EmailCheck {
  const email = normalizeEmail(completeEmail(raw));
  if (!email) return { ok: false, message: "Enter your email address." };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return { ok: false, message: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can sign in.` };
  }
  return { ok: true, email };
}
