// Agency agreement state pill. State comes from v_agent_agreement_state.
export type AgreementState = 'active' | 'expiring' | 'expired' | 'awaiting' | 'draft' | 'none'

const TONE: Record<AgreementState, { bg: string; fg: string; dot: string; ring?: string }> = {
  active: { bg: '#ECFDF3', fg: '#067647', dot: '#12B76A' },
  expiring: { bg: '#FFFAEB', fg: '#B54708', dot: '#F79009' },
  expired: { bg: '#FEF3F2', fg: '#B42318', dot: '#F04438' },
  awaiting: { bg: '#EFF4FF', fg: '#1D4ED8', dot: '#2E5BFF' },
  draft: { bg: '#F2F4F7', fg: '#344054', dot: '#98A2B3' },
  none: { bg: '#FFFFFF', fg: '#667085', dot: '#D0D5DD', ring: '#E4E7EC' },
}

export const AGREEMENT_FILTERS: { key: 'all' | AgreementState; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
  { key: 'awaiting', label: 'Awaiting signature' },
  { key: 'draft', label: 'Draft' },
  { key: 'none', label: 'None' },
]

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function agreementLabel(state: AgreementState, expiry?: string | null, daysLeft?: number | null, long = false): string {
  switch (state) {
    case 'active': return expiry ? `${long ? 'Active agreement · to' : 'Active to'} ${fmtDate(expiry)}` : 'Active'
    case 'expiring': return daysLeft != null ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Expiring'
    case 'expired': return expiry ? `Expired ${fmtDate(expiry)}` : 'Expired'
    case 'awaiting': return 'Awaiting signature'
    case 'draft': return long ? 'Draft agreement' : 'Draft'
    default: return long ? 'No agreement' : 'None'
  }
}

export default function AgreementPill({ state, expiry, daysLeft, long }: {
  state: AgreementState | string | null | undefined
  expiry?: string | null
  daysLeft?: number | null
  long?: boolean
}) {
  const s = (state && state in TONE ? state : 'none') as AgreementState
  const t = TONE[s]
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] leading-4"
      style={{ background: t.bg, color: t.fg, boxShadow: t.ring ? `inset 0 0 0 1px ${t.ring}` : undefined }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
      {agreementLabel(s, expiry, daysLeft, long)}
    </span>
  )
}
