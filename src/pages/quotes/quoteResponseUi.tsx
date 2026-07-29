const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  sent_for_approval: 'Sent for approval',
  approved: 'Approved',
}

export function responseStatusPill(status: string) {
  const key = status.toLowerCase().replace(/_/g, '-')
  const label = STATUS_LABELS[status] ?? status
  return <span className={`quote-response-pill quote-response-pill--${key}`}>{label}</span>
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtResponseMoney(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export { fmtDate }
