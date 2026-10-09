import type { CheckResult, CreditorInvoice } from './creditorInvoicesApi'

const VERDICT: Record<string, { label: string; cls: string }> = {
  ok: { label: 'OK to approve', cls: 'bk-pill bk-pill--green' },
  over: { label: 'Over expected', cls: 'bk-pill bk-pill--amber' },
  under: { label: 'Under expected', cls: 'bk-pill bk-pill--amber' },
  no_expected: { label: 'No expected cost', cls: 'bk-pill bk-pill--amber' },
  duplicate: { label: 'Possible duplicate', cls: 'bk-pill bk-pill--amber' },
  check_ref: { label: 'Check reference', cls: 'bk-pill bk-pill--amber' },
  unread: { label: 'Not read', cls: 'bk-pill' },
}

export function VerdictPill({ check, ai }: { check: CheckResult | null; ai: CreditorInvoice['ai_status'] }) {
  if (ai === 'reading') return <span className="bk-pill">Reading…</span>
  if (ai === 'failed') return <span className="bk-pill bk-pill--amber">Read failed</span>
  if (!check) return <span className="bk-pill">Not checked</span>
  const v = VERDICT[check.verdict] ?? { label: check.verdict, cls: 'bk-pill' }
  return <span className={v.cls} title={check.reasons?.join('\n')}>{v.label}</span>
}

export function StatusPills({ inv }: { inv: CreditorInvoice }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {inv.status === 'approved' && <span className="bk-pill bk-pill--green">Approved</span>}
      {inv.status === 'disputed' && <span className="bk-pill bk-pill--amber">Disputed</span>}
      {inv.status === 'received' && <span className="bk-pill">Received</span>}
      {inv.urgent && <span className="bk-pill" style={{ background: '#FEE2E2', color: '#B91C1C' }}>Urgent</span>}
      {inv.sent_at && <span className="bk-pill">Sent</span>}
      {inv.needs_restamp && inv.status === 'approved' && <span className="bk-pill bk-pill--amber">Re-stamp</span>}
    </span>
  )
}
