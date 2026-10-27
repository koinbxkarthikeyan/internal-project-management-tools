import { ALLOWED_DOMAINS_AND_TEXT, ALLOWED_EMAIL_DOMAINS } from "@/constants/auth";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Is this the exact domain of an allowed address? (`koinbx.com.example.com` and `evilkoinbx.com` are not.) */
export const isAllowedDomain = (domain: string) => (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain.toLowerCase());

/**
 * Company addresses to offer for what is typed so far, only once an "@" has been typed after a name: `sasi@` offers `sasi@koinbx.com` and `sasi@koinbazar.com`,
 * `sasi@koinba` only the one that starts that way. Nothing is ever inserted by itself: the person picks one, or keeps typing.
 */
export function emailSuggestions(raw: string): string[] {
  const s = raw.trim().toLowerCase();
  const at = s.indexOf("@");
  if (at < 1 || s.indexOf("@", at + 1) !== -1) return [];
  const local = s.slice(0, at);
  const typed = s.slice(at + 1);
  return ALLOWED_EMAIL_DOMAINS.filter((d) => d.startsWith(typed) && d !== typed).map((d) => `${local}@${d}`);
}

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string };

/** Shown for an address on a domain that is not allowed, and for one that is not an email address at all. */
export const DOMAIN_MESSAGE = `Only ${ALLOWED_DOMAINS_AND_TEXT} email addresses can sign in.`;
export const FORMAT_MESSAGE = "Enter a valid email address.";

/**
 * Only well-formed addresses on an allowed domain (`@koinbx.com` or `@koinbazar.com`, matched exactly) are accepted (being valid does not grant access).
 * The address is checked as written: nothing is completed or changed here. A domain that is not allowed gets the domain message as soon as it is identifiable
 * (`sasi@gmail`); anything that is not an address gets the format message.
 */
export function validateEmail(raw: string): EmailCheck {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, message: "Enter your email address." };
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1] || /\s/.test(email)) return { ok: false, message: FORMAT_MESSAGE };
  if (!isAllowedDomain(parts[1])) return { ok: false, message: DOMAIN_MESSAGE };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, message: FORMAT_MESSAGE };
  return { ok: true, email };
}

/**
 * The message to show next to an email field while it is being typed, or "" when there is nothing to say (yet). An empty field says nothing; a name with
 * no "@" (or nothing after it) says nothing until `final` (the field was left); a domain that could still become an allowed one (`koinba`) says nothing until `final`.
 */
export function emailProblem(raw: string, final = false): string {
  const email = normalizeEmail(raw);
  if (!email) return "";
  const at = email.indexOf("@");
  const domain = email.slice(at + 1);
  const stillTyping = at === -1 || (at > 0 && domain === "") || (at > 0 && !domain.includes("@") && ALLOWED_EMAIL_DOMAINS.some((d) => d.startsWith(domain)));
  if (!final && stillTyping) return "";
  const checked = validateEmail(email);
  return checked.ok ? "" : checked.message;
}
