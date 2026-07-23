/** Compact board date: "19 Jul" */
export function fmtBoardDate(value: string | null): string {
  if (!value?.trim()) return '—'
  const iso = value.includes('T') ? value : `${value.trim()}T12:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value.trim()
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}
