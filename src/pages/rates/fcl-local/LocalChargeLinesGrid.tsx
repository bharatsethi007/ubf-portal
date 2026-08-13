import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useChargeCodes, useContainerTypes, useCurrencies } from '../../../hooks/useQuoteRefData'
import MultiChipSelect from '../../../components/MultiChipSelect'
import VendorSelect, { type VendorValue } from '../VendorSelect'
import { groupForDirection, type LocalChargeLineDraft } from './localChargesDetailApi'

const BASES = [
  { v: 'per_container', label: 'Per container' },
  { v: 'per_bl', label: 'Per B/L' },
  { v: 'per_shipment', label: 'Per shipment' },
  { v: 'percent', label: 'Percent of freight' },
] as const

let tmpSeq = 0
export function newLocalChargeLine(defaultCurrency: string): LocalChargeLineDraft {
  tmpSeq += 1
  return {
    key: `tmp-${tmpSeq}`,
    dbId: null,
    charge_code: '',
    label: '',
    container_types: [],
    basis: 'per_container',
    buy_amount: '',
    buy_currency: defaultCurrency,
    sell_amount: '',
    sell_currency: defaultCurrency,
    min_buy: '',
    min_sell: '',
    vendor_account_id: '',
    vendor_name: '',
    condition: '',
  }
}

type Props = {
  rows: LocalChargeLineDraft[]
  direction: string
  defaultCurrency: string
  onChange: (rows: LocalChargeLineDraft[]) => void
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }

export default function LocalChargeLinesGrid({ rows, direction, defaultCurrency, onChange }: Props) {
  const { items: chargeCodes } = useChargeCodes()
  const { items: containers } = useContainerTypes()
  const { items: currencies } = useCurrencies()

  const group = groupForDirection(direction)
  const codeOptions = useMemo(
    () => chargeCodes.filter((c) => c.charge_group === group),
    [chargeCodes, group],
  )
  const containerOptions = useMemo(
    () => containers.map((c) => ({ value: c.code, label: c.code })),
    [containers],
  )

  function update(key: string, patch: Partial<LocalChargeLineDraft>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function remove(key: string) {
    onChange(rows.filter((r) => r.key !== key))
  }
  function add() {
    onChange([...rows, newLocalChargeLine(defaultCurrency)])
  }
  function onCode(key: string, code: string) {
    const cc = chargeCodes.find((c) => c.code === code)
    const row = rows.find((r) => r.key === key)
    const patch: Partial<LocalChargeLineDraft> = { charge_code: code }
    if (cc && (!row || !row.label.trim())) patch.label = cc.description || code
    update(key, patch)
  }
  function onBuyAmount(r: LocalChargeLineDraft, v: string) {
    const patch: Partial<LocalChargeLineDraft> = { buy_amount: v }
    if ((r.sell_amount ?? '') === '') patch.sell_amount = v
    update(r.key, patch)
  }

  const curOpts = currencies.map((c) => c.code)
  const isPercent = (b: string) => b === 'percent'

  return (
    <div>
      <datalist id="lcl-charge-codes">
        {codeOptions.map((c) => (<option key={c.code} value={c.code}>{c.code} — {c.description}</option>))}
      </datalist>

      {rows.length === 0 ? (
        <p className="text-muted-foreground" style={{ fontSize: 14 }}>No charge lines yet. Add one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((r) => {
            const vendorValue: VendorValue = r.vendor_account_id ? { account_id: r.vendor_account_id, name: r.vendor_name || r.vendor_account_id } : null
            const pct = isPercent(r.basis)
            return (
              <div key={r.key} style={{ border: '1px solid var(--border, #E3E7ED)', borderRadius: 10, padding: 14, position: 'relative' }}>
                <button type="button" onClick={() => remove(r.key)} aria-label="Remove line"
                  style={{ position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: '#B23B3B', padding: 4 }}>
                  <Trash2 size={16} />
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Charge code</label>
                    <input className="input input--sm" list="lcl-charge-codes" value={r.charge_code}
                      onChange={(e) => onCode(r.key, e.target.value)} placeholder="Select or type new…" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Label</label>
                    <input className="input input--sm" value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} placeholder="Description" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Container types</label>
                    <MultiChipSelect options={containerOptions} value={r.container_types}
                      onChange={(v) => update(r.key, { container_types: v })} placeholder="All sizes" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Basis</label>
                    <select className="input input--sm" value={r.basis} onChange={(e) => update(r.key, { basis: e.target.value })}>
                      {BASES.map((b) => (<option key={b.v} value={b.v}>{b.label}</option>))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>{pct ? 'Buy %' : 'Buy'}</label>
                    <input className="input input--sm" type="number" inputMode="decimal" value={r.buy_amount} onChange={(e) => onBuyAmount(r, e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Buy cur</label>
                    <select className="input input--sm" value={r.buy_currency} onChange={(e) => update(r.key, { buy_currency: e.target.value })}>
                      <option value="">—</option>
                      {curOpts.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>{pct ? 'Sell %' : 'Sell'}</label>
                    <input className="input input--sm" type="number" inputMode="decimal" value={r.sell_amount} onChange={(e) => update(r.key, { sell_amount: e.target.value })} placeholder={r.buy_amount || '—'} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Sell cur</label>
                    <select className="input input--sm" value={r.sell_currency} onChange={(e) => update(r.key, { sell_currency: e.target.value })}>
                      <option value="">—</option>
                      {curOpts.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Min buy</label>
                    <input className="input input--sm" type="number" inputMode="decimal" value={r.min_buy} onChange={(e) => update(r.key, { min_buy: e.target.value })} placeholder="—" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Min sell</label>
                    <input className="input input--sm" type="number" inputMode="decimal" value={r.min_sell} onChange={(e) => update(r.key, { min_sell: e.target.value })} placeholder="—" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(160px, 1fr)', gap: 12, marginTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Vendor</label>
                    <VendorSelect value={vendorValue} onChange={(v) => update(r.key, { vendor_account_id: v?.account_id ?? '', vendor_name: v?.name ?? '' })} placeholder="Search customer / contact… (optional)" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Condition</label>
                    <input className="input input--sm" value={r.condition} onChange={(e) => update(r.key, { condition: e.target.value })} placeholder="e.g. reefer only" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--inline" onClick={add}>
          <Plus size={15} strokeWidth={2} /> Add charge
        </button>
        <span className="text-muted-foreground" style={{ fontSize: 12 }}>
          Percent is of the freight rate. The quote takes the greater of the computed amount and the minimum.
        </span>
      </div>
    </div>
  )
}
