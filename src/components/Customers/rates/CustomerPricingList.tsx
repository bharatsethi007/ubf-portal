import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import ContractRateDialog from '@/pages/rates/margins/ContractRateDialog'
import { deleteContractRule, describeContract, isLaneRule, type ContractRule } from '@/pages/rates/margins/contractRatesApi'
import { PRODUCTS } from '@/pages/rates/margins/marginRulesApi'
import { listCustomerRules } from './customerRatesApi'

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' }) : '')
const live = (r: ContractRule) => {
  const t = new Date().toISOString().slice(0, 10)
  return r.active && (!r.valid_to || r.valid_to >= t) && (!r.valid_from || r.valid_from <= t)
}

/** This customer's margins and contract rates. Same records as Setup > Rates > Customer pricing. */
export default function CustomerPricingList({ accountId, name }: { accountId: string; name: string }) {
  const [rows, setRows] = useState<ContractRule[]>([])
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<ContractRule | null>(null)
  // Stable object: the dialog resets its form when this changes.
  const me = useMemo(() => ({ account_id: accountId, name } as CustomerPickerValue), [accountId, name])

  const load = useCallback(async () => {
    try { setRows(await listCustomerRules(accountId)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load') }
  }, [accountId])
  useEffect(() => { void load() }, [load])

  async function remove(r: ContractRule) {
    if (!window.confirm('Remove this pricing rule?')) return
    try { await deleteContractRule(r.id); void load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove') }
  }

  return (
    <section className="cp-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Pricing and contract rates</h3>
        <span className="text-muted-foreground" style={{ fontSize: 12.5 }}>Lane rules beat product margins. Most specific wins.</span>
        <button type="button" className="btn quotes-page__new-btn" style={{ marginLeft: 'auto' }} onClick={() => { setEdit(null); setOpen(true) }} aria-label="Add pricing rule" title="Add pricing rule">
          <Plus size={14} />
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Product</th><th>Lane</th><th>Carrier</th><th>Price</th><th>Valid</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = PRODUCTS.find((x) => x.v === r.product)
              return (
                <tr key={r.id} style={live(r) ? undefined : { opacity: 0.55 }}>
                  <td>{p?.label}{r.container_type ? ` · ${r.container_type}` : ''}</td>
                  <td className="mono">{isLaneRule(r) ? `${r.origin_code ?? 'Any'} → ${r.dest_code ?? 'Any'}` : <span className="text-muted-foreground">All lanes</span>}</td>
                  <td>{r.carrier ?? <span className="text-muted-foreground">Any</span>}</td>
                  <td title={r.notes ?? undefined}>{describeContract(r, p?.unit ?? '')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.valid_from || r.valid_to ? `${fmt(r.valid_from) || 'Now'} to ${fmt(r.valid_to) || 'open'}` : <span className="text-muted-foreground">Always</span>}</td>
                  <td>{live(r) ? 'Live' : r.active ? 'Out of date' : 'Off'}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button type="button" className="btn" onClick={() => { setEdit(r); setOpen(true) }} aria-label="Edit"><Pencil size={14} /></button>
                    <button type="button" className="btn" style={{ marginLeft: 6 }} onClick={() => void remove(r)} aria-label="Remove"><Trash2 size={14} /></button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="text-muted-foreground pad-inline">Standard pricing. No customer rules.</td></tr>}
          </tbody>
        </table>
      </div>
      <ContractRateDialog open={open} rule={edit} defaultCustomer={me}
        onClose={() => setOpen(false)} onSaved={() => { setOpen(false); void load() }} />
    </section>
  )
}
