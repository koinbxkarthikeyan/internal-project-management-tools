export const MIN_PASSWORD_LENGTH = 8;

export const TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;

/** Returns a message when the new password isn't acceptable, otherwise "". */
/** Returns a message when the new password isn't acceptable, otherwise "". */
export function checkNewPassword(password: string): string {
  if (!password) return "Enter a new password.";
  if (password.length < MIN_PASSWORD_LENGTH) return TOO_SHORT;
  return "";
}
