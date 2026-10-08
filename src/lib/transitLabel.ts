/** "3" -> "3 days", "3-5" -> "3-5 days", "5-7 days" / "Weekly" stay as typed. */
export function transitLabel(v: string | number | null | undefined): string {
  const t = String(v ?? '').trim()
  if (!t) return ''
  if (/^\d+(\s*[-–to]+\s*\d+)?$/i.test(t)) return `${t.replace(/\s*(-|–|to)\s*/i, '-')} days`
  return t
}
