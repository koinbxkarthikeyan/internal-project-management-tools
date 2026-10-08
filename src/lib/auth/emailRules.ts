import { ALLOWED_EMAIL_DOMAIN } from "@/constants/auth";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string };

/** Only well-formed addresses ending exactly in `@koinbx.com` are accepted (being valid does not grant access). */
export function validateEmail(raw: string): EmailCheck {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, message: "Enter your email address." };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return { ok: false, message: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can sign in.` };
  }
  return { ok: true, email };
}
