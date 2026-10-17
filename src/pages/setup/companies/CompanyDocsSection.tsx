import { useState } from 'react'
import { toast } from 'sonner'
import { updateCompany, errText, type Company } from '../../../features/company/companyApi'

type Props = { rows: Company[]; setRows: (f: (r: Company[]) => Company[]) => void; reload: () => Promise<void> }

type Field = { key: keyof Company; label: string; multi?: boolean; list?: boolean; hint?: string }
const FIELDS: Field[] = [
  { key: 'trading_name', label: 'Trading name', hint: 'Signatures, rate card cover' },
  { key: 'website', label: 'Website' },
  { key: 'terms_url', label: 'Terms URL' },
  { key: 'customs_code', label: 'Customs client code', hint: 'Booking confirmation agent block' },
  { key: 'remit_to', label: 'Remit to', multi: true },
  { key: 'bank_name', label: 'Bank' },
  { key: 'bank_swift', label: 'SWIFT' },
  { key: 'bank_accounts', label: 'Bank accounts', list: true, hint: 'One per line' },
  { key: 'payment_notes', label: 'Payment notes', list: true, hint: 'One per line' },
  { key: 'invoice_queries', label: 'Invoice queries note', multi: true },
  { key: 'invoice_terms', label: 'Invoice terms', multi: true },
]

// What invoices, statements, quotes, rate cards and booking confirmations print for each company.
// Address, phone and emails live on the branch (table above).
export default function CompanyDocsSection({ rows, setRows, reload }: Props) {
  const [code, setCode] = useState(rows[0]?.code ?? 'NZ')
  const c = rows.find((r) => r.code === code)
  if (!c) return null

  const text = (f: Field) => {
    const v = c[f.key]
    return f.list ? ((v as string[] | null) ?? []).join('\n') : ((v as string | null) ?? '')
  }
  const edit = (f: Field, v: string) =>
    setRows((rs) => rs.map((r) => (r.code === code ? { ...r, [f.key]: f.list ? v.split('\n') : v } : r)))
  async function save(f: Field, v: string) {
    const val = f.list ? v.split('\n').map((x) => x.trim()).filter(Boolean) : (v.trim() || null)
    try { await updateCompany(code, { [f.key]: val } as Partial<Company>); toast.success('Saved') }
    catch (e) { toast.error(errText(e)); await reload() }
  }

  return (
    <>
      <h2 style={{ margin: '24px 0 4px', fontSize: 14, fontWeight: 600 }}>Documents</h2>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
        Printed on invoices, statements, quotes, rate cards and booking confirmations. Address, phone and email come from the branch.
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {rows.map((r) => (
          <button key={r.code} type="button" className={`quotes-tabs__btn${r.code === code ? ' quotes-tabs__btn--on' : ''}`}
            onClick={() => setCode(r.code)}>{r.code}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 640px)', gap: '6px 12px', alignItems: 'start' }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ display: 'contents' }}>
            <span style={{ fontSize: 12, paddingTop: 7 }} title={f.hint}>{f.label}</span>
            {f.multi || f.list ? (
              <textarea className="input input--sm" rows={f.key === 'invoice_terms' ? 3 : 2}
                style={{ height: 'auto', resize: 'vertical' }} placeholder={f.hint}
                value={text(f)} onChange={(e) => edit(f, e.target.value)} onBlur={(e) => void save(f, e.target.value)} />
            ) : (
              <input className="input input--sm" placeholder={f.hint} value={text(f)}
                onChange={(e) => edit(f, e.target.value)} onBlur={(e) => void save(f, e.target.value)} />
            )}
          </label>
        ))}
      </div>
    </>
  )
}
