export const MIN_PASSWORD_LENGTH = 8;

/** Returns a message when the new password isn't acceptable, otherwise "". */
export function checkNewPassword(password: string): string {
  if (!password) return "Enter a new password.";
  if (password.length < MIN_PASSWORD_LENGTH) return `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return "";
}

/**
 * A random initial password for an account created without a password step (e.g. "+ Add Team Member" in a backlog form).
 * It is made from the browser's secure random source, sent once in the create request, and never shown or stored. A User
 * signs in with an emailed code, so nobody needs it; an Admin can set a known password later (Edit user > Reset password).
 */
export function generatePassword(length = 16): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*"];
  const all = sets.join("");
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const out = [...sets.map(pick), ...Array.from({ length: length - sets.length }, () => pick(all))];
  // Shuffle so the guaranteed characters aren't always first.
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
