// Staff password policy. Mirror of src/auth/passwordPolicy.ts (keep in sync).
export const STAFF_PASSWORD_MIN = 12;

export function validateStaffPassword(password: string): string | null {
  if (password.length < STAFF_PASSWORD_MIN) return `Password must be at least ${STAFF_PASSWORD_MIN} characters.`;
  if (!/[a-z]/.test(password)) return "Password needs a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password needs an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password needs a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password needs a symbol.";
  return null;
}
