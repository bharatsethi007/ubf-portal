import { useEffect, useState } from 'react'
import { listEvents, type InvoiceEvent } from './creditorInvoicesApi'
import { nzDateTime } from './stampPdf'

const LABEL: Record<string, string> = {
  received: 'Received', read: 'Read by AI', approved: 'Approved', modified: 'Modified', disputed: 'Disputed',
  reopened: 'Reopened', stamped: 'Stamped', sent: 'Sent to accounts',
}

function summary(e: InvoiceEvent): string {
  const d = e.detail ?? {}
  if (e.action === 'modified') return Object.entries(d).map(([k, v]) => {
    const c = v as { from: unknown; to: unknown }; return `${k.replace(/_/g, ' ')} ${c?.from ?? '-'} → ${c?.to ?? '-'}`
  }).join(', ')
  if (e.action === 'approved') return `Pay by ${d.pay_by ?? '-'}${d.urgent ? ', urgent' : ''}`
  if (e.action === 'disputed') return String(d.reason ?? '')
  if (e.action === 'read') return `Verdict ${d.verdict ?? '-'}`
  if (e.action === 'sent') return String(d.to ?? '')
  return ''
}

export default function InvoiceHistory({ invoiceId, tick }: { invoiceId: string; tick: number }) {
  const [rows, setRows] = useState<InvoiceEvent[]>([])
  useEffect(() => { void listEvents(invoiceId).then(setRows).catch(() => setRows([])) }, [invoiceId, tick])
  if (rows.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div className="text-sm" style={{ fontWeight: 500 }}>History</div>
      {rows.map((e) => (
        <div key={e.id} className="text-sm" style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8 }}>
          <span className="text-muted-foreground">{nzDateTime(e.created_at)}</span>
          <span>{LABEL[e.action] ?? e.action} · {e.actor_name ?? ''}{summary(e) ? ` · ${summary(e)}` : ''}</span>
        </div>
      ))}
    </div>
  )
}
