export function fmtDate(d: string | null, withTime = false): string {
  if (!d) return '—'
  const iso = d.includes('T') ? d : `${d}T00:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  if (withTime) {
    return date.toLocaleString('en-NZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function fmtShort(d: string | null): string {
  if (!d) return '—'
  const iso = d.includes('T') ? d : `${d}T00:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtProgress(d: string | null): string {
  if (!d) return '—'
  const iso = d.includes('T') ? d : `${d}T00:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return '—'
  const n = amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${currency} ${n}` : n
}

export function shipmentLabel(s: { job_no: string | null; house_bill: string | null; job_unique: number }): string {
  return s.job_no || s.house_bill || `Job ${s.job_unique}`
}
