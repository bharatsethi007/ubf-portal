const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  sent_for_approval: 'Awaiting customer',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const EXTRA_STYLE: Record<string, { color: string; background: string }> = {
  rejected: { color: '#B91C1C', background: '#FEF2F2' },
  withdrawn: { color: '#64748B', background: '#F1F5F9' },
}

export function responseStatusPill(status: string) {
  const key = status.toLowerCase().replace(/_/g, '-')
  const label = STATUS_LABELS[status] ?? status
  return <span className={`quote-response-pill quote-response-pill--${key}`} style={EXTRA_STYLE[status]}>{label}</span>
}

/** Response can go to the customer portal. */
export const canSendToPortal = (status: string) => status === 'draft' || status === 'published' || status === 'withdrawn'

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
