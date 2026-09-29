import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PRODUCTS, deleteMarginRule, saveMarginRule, type MarginRule, type Method, type Product } from './marginRulesApi'

type Props = {
  /** Existing rule, or a blank default for a product that has none yet. */
  rule: MarginRule | null
  product: Product
  accountId: string | null
  label: string
  sub?: string
  onSaved: () => void
}

/** One editable margin: method, value, floor, on/off. */
export default function MarginRuleRow({ rule, product, accountId, label, sub, onSaved }: Props) {
  const meta = PRODUCTS.find((p) => p.v === product)!
  const [method, setMethod] = useState<Method>(rule?.method ?? meta.defaultMethod)
  const [value, setValue] = useState(rule ? String(rule.value) : '')
  const [floor, setFloor] = useState(rule?.min_margin != null ? String(rule.min_margin) : '')
  const [active, setActive] = useState(rule?.active ?? true)
  const [busy, setBusy] = useState(false)

  const dirty = !rule
    ? value !== ''
    : method !== rule.method || Number(value) !== Number(rule.value) || (floor === '' ? null : Number(floor)) !== rule.min_margin || active !== rule.active

  async function save() {
    if (value === '' || Number.isNaN(Number(value)) || Number(value) < 0) { toast.error('Enter a margin of 0 or more'); return }
    setBusy(true)
    try {
      await saveMarginRule({ account_id: accountId, product, method, value: Number(value), min_margin: floor === '' ? null : Number(floor), active, notes: rule?.notes ?? null }, rule?.id)
      toast.success(`${label} margin saved`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!rule || !window.confirm(`Remove the ${label} margin?`)) return
    setBusy(true)
    try {
      await deleteMarginRule(rule.id)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove')
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {sub && <div className="text-muted-foreground" style={{ fontSize: 12 }}>{sub}</div>}
      </td>
      <td>
        <select className="input input--sm" value={method} onChange={(e) => setMethod(e.target.value as Method)} aria-label="Method">
          <option value="pct">% on buy</option>
          <option value="flat">Flat {meta.unit}</option>
        </select>
      </td>
      <td>
        <input className="input input--sm" style={{ width: 96 }} inputMode="decimal" value={value} placeholder={method === 'pct' ? 'e.g. 12' : 'e.g. 150'}
          onChange={(e) => setValue(e.target.value)} aria-label="Margin" />
        <span className="text-muted-foreground" style={{ marginLeft: 6, fontSize: 12 }}>{method === 'pct' ? '%' : meta.unit}</span>
      </td>
      <td>
        <input className="input input--sm" style={{ width: 96 }} inputMode="decimal" value={floor} placeholder="optional"
          onChange={(e) => setFloor(e.target.value)} aria-label="Minimum margin" />
      </td>
      <td>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> On
        </label>
      </td>
      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
        <button type="button" className="btn" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
        </button>
        {rule && (
          <button type="button" className="btn" style={{ marginLeft: 6 }} disabled={busy} onClick={() => void remove()} aria-label={`Remove ${label} margin`}>
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}
