export type PortalRange = 'year' | 'month' | 'week' | 'today' | 'custom'

export const RANGE_LABELS: Record<PortalRange, string> = {
  year: 'Last year',
  month: 'Last month',
  week: 'This week',
  today: 'Today',
  custom: 'Custom',
}

export function rangeBounds(range: PortalRange): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  to.setHours(23, 59, 59, 999)
  from.setHours(0, 0, 0, 0)

  switch (range) {
    case 'today':
      break
    case 'week':
      from.setDate(from.getDate() - 6)
      break
    case 'month':
      from.setMonth(from.getMonth() - 1)
      break
    case 'year':
      from.setFullYear(from.getFullYear() - 1)
      break
    case 'custom':
      from.setMonth(from.getMonth() - 3)
      break
  }

  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function previousRangeBounds(range: PortalRange): { from: string; to: string } {
  const cur = rangeBounds(range)
  const from = new Date(cur.from)
  const to = new Date(cur.to)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))
  to.setDate(to.getDate() - days - 1)
  from.setDate(from.getDate() - days - 1)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function formatMoney(amount: number, currency = 'NZD'): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

export function formatDateTimeLabel(d = new Date()): string {
  return d.toLocaleString('en-NZ', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function formatKg(kg: number): string {
  if (kg <= 0) return '0 kg'
  return `${new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 0 }).format(Math.round(kg))} kg`
}

export function formatCbm(cbm: number): string {
  if (cbm <= 0) return '0 CBM'
  const n = cbm >= 100 ? Math.round(cbm) : Math.round(cbm * 10) / 10
  return `${new Intl.NumberFormat('en-NZ', { maximumFractionDigits: cbm >= 100 ? 0 : 1 }).format(n)} CBM`
}

export function portCountryCode(code: string | null | undefined): string {
  if (!code || code.length < 2) return 'un'
  return code.slice(0, 2).toLowerCase()
}
