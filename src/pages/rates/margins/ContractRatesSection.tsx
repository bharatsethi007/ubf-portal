import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PRODUCTS } from './marginRulesApi'
import ContractRateDialog from './ContractRateDialog'
import { deleteContractRule, describeContract, listContractRules, saveContractRule, type ContractRule } from './contractRatesApi'

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

function status(r: ContractRule): { label: string; color: string } {
  const t = today()
  if (!r.active) return { label: 'Off', color: 'var(--muted-foreground)' }
  if (r.valid_to && r.valid_to < t) return { label: 'Expired', color: 'var(--muted-foreground)' }
  if (r.valid_from && r.valid_from > t) return { label: 'Starts ' + fmt(r.valid_from), color: '#b45309' }
  return { label: 'Live', color: '#15803d' }
}

/** Staff: lane-level prices and margins per customer. Portal search applies them automatically. */
export default function ContractRatesSection() {
  const [rows, setRows] = useState<ContractRule[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<ContractRule | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setRows(await listContractRules().catch(() => []))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => [r.customers?.name, r.account_id, r.origin_code, r.dest_code, r.carrier, r.container_type].some((x) => x?.toLowerCase().includes(s)))
  }, [rows, q])

  async function toggle(r: ContractRule) {
    try {
      const { id, updated_at: _u, customers: _c, ...d } = r
      await saveContractRule({ ...d, active: !r.active }, id)
      void load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update') }
  }

  async function remove(r: ContractRule) {
    if (!window.confirm(`Remove this contract rate for ${r.customers?.name ?? r.account_id}?`)) return
    try { await deleteContractRule(r.id); void load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove') }
  }

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Contract rates</h2>
        <span className="text-muted-foreground" style={{ fontSize: 12.5 }}>Lane prices for one customer. Most specific rule wins. Shown first on their portal with a "Your contract rate" tag.</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input className="input input--sm" placeholder="Search customer, port, carrier" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 230 }} />
          <button type="button" className="btn quotes-page__new-btn" onClick={() => { setEdit(null); setOpen(true) }} aria-label="New contract rate" title="New contract rate">
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Product</th><th>Lane</th><th>Carrier</th><th>Price</th><th>Valid</th><th>Status</th><th /></tr></thead>
          <tbody>
            {shown.map((r) => {
              const p = PRODUCTS.find((x) => x.v === r.product)
              const s = status(r)
              return (
                <tr key={r.id}>
                  <td><div style={{ fontWeight: 600 }}>{r.customers?.name ?? r.account_id}</div><div className="text-muted-foreground mono" style={{ fontSize: 12 }}>{r.account_id}</div></td>
                  <td>{p?.label}{r.container_type ? ` · ${r.container_type}` : ''}</td>
                  <td className="mono">{r.origin_code ?? 'Any'} → {r.dest_code ?? 'Any'}</td>
                  <td>{r.carrier ?? <span className="text-muted-foreground">Any</span>}</td>
                  <td title={r.notes ?? undefined}>{describeContract(r, p?.unit ?? '')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.valid_from || r.valid_to ? `${fmt(r.valid_from) || 'Now'} to ${fmt(r.valid_to) || 'open'}` : <span className="text-muted-foreground">Always</span>}</td>
                  <td>
                    <button type="button" className="btn btn--secondary" style={{ color: s.color, height: 28, padding: '0 10px', fontSize: 12.5 }} onClick={() => void toggle(r)} title={r.active ? 'Turn off' : 'Turn on'}>{s.label}</button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button type="button" className="btn btn--icon" onClick={() => { setEdit(r); setOpen(true) }} aria-label="Edit" title="Edit"><Pencil size={14} /></button>
                    <button type="button" className="btn btn--icon btn--danger" style={{ marginLeft: 6 }} onClick={() => void remove(r)} aria-label="Remove" title="Remove"><Trash2 size={14} /></button>
                  </td>
                </tr>
              )
            })}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={8} className="text-muted-foreground pad-inline">{rows.length ? 'No matches.' : 'No contract rates yet. Use + to add one.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ContractRateDialog open={open} rule={edit} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); void load() }} />
    </section>
  )
}
