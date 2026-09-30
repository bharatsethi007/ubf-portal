/** Compact board date: "19/07" (dd/mm). Full date shows in the cell title. */
export function fmtBoardDate(value: string | null): string {
  if (!value?.trim()) return '—'
  const iso = value.includes('T') ? value : `${value.trim()}T12:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value.trim()
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

/** Long form for tooltips: "19 Jul 2026". */
export function fmtBoardDateLong(value: string | null): string {
  if (!value?.trim()) return ''
  const iso = value.includes('T') ? value : `${value.trim()}T12:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value.trim()
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}
