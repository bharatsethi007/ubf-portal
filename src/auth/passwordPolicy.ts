// Staff password policy. Mirror of supabase/functions/_shared/passwordPolicy.ts (keep in sync).
export const STAFF_PASSWORD_MIN = 12

export const PASSWORD_RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'len', label: `At least ${STAFF_PASSWORD_MIN} characters`, test: (p) => p.length >= STAFF_PASSWORD_MIN },
  { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'num', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { id: 'sym', label: 'One symbol (e.g. ! @ # $)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function passwordMeetsPolicy(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p))
}
