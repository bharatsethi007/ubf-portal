import { useState } from 'react'
import { Save } from 'lucide-react'
import DateField from '@/components/DateField'
import { COST_TYPES } from '../costTypes'
import type { CreditorInvoice } from './creditorInvoicesApi'

type Props = { inv: CreditorInvoice; busy: boolean; onSave: (patch: Partial<CreditorInvoice>) => void }

const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 8 }

export default function InvoiceFields({ inv, busy, onSave }: Props) {
  const [f, setF] = useState({
    vendor_name: inv.vendor_name ?? '', invoice_no: inv.invoice_no ?? '', invoice_date: inv.invoice_date, due_date: inv.due_date,
    currency: inv.currency, total: inv.total == null ? '' : String(inv.total), tax: inv.tax == null ? '' : String(inv.tax),
    cost_type: inv.cost_type ?? '', pay_by: inv.pay_by, urgent: inv.urgent, approval_comment: inv.approval_comment ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const approved = inv.status === 'approved'

  function save() {
    const n = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s))
    const patch: Partial<CreditorInvoice> = {
      vendor_name: f.vendor_name.trim() || null, invoice_no: f.invoice_no.trim() || null, invoice_date: f.invoice_date, due_date: f.due_date,
      currency: f.currency.toUpperCase().slice(0, 3) || 'NZD', total: n(f.total), tax: n(f.tax), cost_type: f.cost_type || null,
      ai_status: inv.ai_status === 'pending' || inv.ai_status === 'failed' ? 'manual' : inv.ai_status,
    }
    if (approved) Object.assign(patch, { pay_by: f.pay_by, urgent: f.urgent, approval_comment: f.approval_comment.trim() || null })
    onSave(patch)
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={row}><span className="text-sm">Vendor</span><input className="input input--sm" value={f.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} /></div>
      <div style={row}><span className="text-sm">Type</span>
        <select className="input input--sm" value={f.cost_type} onChange={(e) => set('cost_type', e.target.value)}>
          <option value="">-</option>{COST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select></div>
      <div style={row}><span className="text-sm">Invoice no</span><input className="input input--sm" value={f.invoice_no} onChange={(e) => set('invoice_no', e.target.value)} /></div>
      <div style={row}><span className="text-sm">Date</span><DateField value={f.invoice_date} onChange={(v) => set('invoice_date', v || null)} width={150} /></div>
      <div style={row}><span className="text-sm">Due</span><DateField value={f.due_date} onChange={(v) => set('due_date', v || null)} width={150} /></div>
      <div style={row}><span className="text-sm">Total</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <input className="input input--sm" style={{ width: 64 }} maxLength={3} value={f.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} />
          <input className="input input--sm" style={{ width: 130, textAlign: 'right' }} inputMode="decimal" value={f.total} onChange={(e) => set('total', e.target.value)} />
          <span className="text-sm text-muted-foreground" style={{ alignSelf: 'center' }}>GST</span>
          <input className="input input--sm" style={{ width: 90, textAlign: 'right' }} inputMode="decimal" value={f.tax} onChange={(e) => set('tax', e.target.value)} />
        </span></div>
      {approved && (
        <>
          <div style={row}><span className="text-sm">Pay by</span><DateField value={f.pay_by} onChange={(v) => v && set('pay_by', v)} width={150} /></div>
          <div style={row}><span className="text-sm">Urgent</span><input type="checkbox" checked={f.urgent} onChange={(e) => set('urgent', e.target.checked)} style={{ justifySelf: 'start' }} /></div>
          <div style={row}><span className="text-sm">Comment</span><input className="input input--sm" value={f.approval_comment} onChange={(e) => set('approval_comment', e.target.value)} /></div>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-sm text-muted-foreground">{approved ? 'Changes are logged and the stamp is redone.' : ''}</span>
        <button className="btn btn--inline" disabled={busy} onClick={save} title="Save" aria-label="Save"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 30, padding: '0 10px' }}><Save size={15} /></button>
      </div>
    </div>
  )
}
