import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CustomerPicker, { type CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { useContainerTypes, useCurrencies } from '@/hooks/useQuoteRefData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { PRODUCTS, type Product } from './marginRulesApi'
import { laneBuyHint, laneCodes, saveContractRule, type BuyHint, type ContractMethod, type ContractRule } from './contractRatesApi'

type Props = { open: boolean; rule: ContractRule | null; defaultCustomer?: CustomerPickerValue | null; onClose: () => void; onSaved: () => void }

const lbl = { fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4, display: 'block' } as const
const up = (s: string) => s.trim().toUpperCase()

/** Add or edit one customer contract rate (lane price or lane margin). */
export default function ContractRateDialog({ open, rule, defaultCustomer = null, onClose, onSaved }: Props) {
  const [cust, setCust] = useState<CustomerPickerValue | null>(null)
  const [product, setProduct] = useState<Product>('FCL')
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [ctr, setCtr] = useState('')
  const [carrier, setCarrier] = useState('')
  const [method, setMethod] = useState<ContractMethod>('fixed')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [floor, setFloor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<{ origins: string[]; dests: string[]; carriers: string[] }>({ origins: [], dests: [], carriers: [] })
  const [hint, setHint] = useState<BuyHint | null>(null)
  const { items: containers } = useContainerTypes()
  const { items: currencies } = useCurrencies()

  useEffect(() => {
    if (!open) return
    setCust(rule ? { account_id: rule.account_id, name: rule.customers?.name ?? rule.account_id } as CustomerPickerValue : defaultCustomer)
    setProduct(rule?.product ?? 'FCL')
    setOrigin(rule?.origin_code ?? ''); setDest(rule?.dest_code ?? ''); setCtr(rule?.container_type ?? ''); setCarrier(rule?.carrier ?? '')
    setMethod(rule?.method ?? 'fixed'); setValue(rule ? String(rule.value) : ''); setCurrency(rule?.currency_code ?? 'USD')
    setFloor(rule?.min_margin != null ? String(rule.min_margin) : ''); setFrom(rule?.valid_from ?? ''); setTo(rule?.valid_to ?? ''); setNotes(rule?.notes ?? '')
  }, [open, rule, defaultCustomer])

  useEffect(() => { if (open) void laneCodes(product).then(setCodes) }, [open, product])

  const laneKey = useDebouncedValue(`${product}|${up(origin)}|${up(dest)}|${up(ctr)}`, 400)
  useEffect(() => {
    if (!open) return
    const [p, o, d, c] = laneKey.split('|')
    if (!d) { setHint(null); return }
    void laneBuyHint({ product: p as Product, origin: o, dest: d, container: c }).then(setHint)
  }, [open, laneKey])

  const unit = PRODUCTS.find((p) => p.v === product)?.unit ?? ''
  const belowCost = method === 'fixed' && hint && hint.count > 0 && value !== '' && Number(value) < hint.max && (!hint.currency || hint.currency === currency)
  const canSave = useMemo(() => !!cust && value !== '' && Number(value) >= 0 && (method !== 'fixed' || !!dest.trim()), [cust, value, method, dest])

  async function save() {
    if (!cust) return
    setBusy(true)
    try {
      await saveContractRule({
        account_id: cust.account_id, product, method, value: Number(value), min_margin: floor === '' ? null : Number(floor),
        origin_code: up(origin) || null, dest_code: up(dest) || null, container_type: up(ctr) || null, carrier: up(carrier) || null,
        currency_code: currency || null, valid_from: from || null, valid_to: to || null, active: rule?.active ?? true, notes: notes.trim() || null,
      }, rule?.id)
      toast.success('Contract rate saved')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{rule ? 'Edit contract rate' : 'New contract rate'}</DialogTitle></DialogHeader>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}><CustomerPicker label="Customer" value={cust} onChange={setCust} required compact /></div>
          <div>
            <span style={lbl}>Product</span>
            <select className="input input--sm" style={{ width: '100%' }} value={product} onChange={(e) => setProduct(e.target.value as Product)}>
              {PRODUCTS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Carrier (blank = any)</span>
            <input className="input input--sm" style={{ width: '100%' }} list="cr-carriers" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Any" />
          </div>
          <div>
            <span style={lbl}>Origin port or group (blank = any)</span>
            <input className="input input--sm mono" style={{ width: '100%' }} list="cr-origins" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. CNSHA or PRD" />
          </div>
          <div>
            <span style={lbl}>Destination port{method === 'fixed' ? ' *' : ''}</span>
            <input className="input input--sm mono" style={{ width: '100%' }} list="cr-dests" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="e.g. NZAKL" />
          </div>
          {product === 'FCL' && (
            <div>
              <span style={lbl}>Container (blank = all)</span>
              <select className="input input--sm" style={{ width: '100%' }} value={ctr} onChange={(e) => setCtr(e.target.value)}>
                <option value="">All</option>
                {containers.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          )}
          <div>
            <span style={lbl}>Pricing</span>
            <select className="input input--sm" style={{ width: '100%' }} value={method} onChange={(e) => setMethod(e.target.value as ContractMethod)}>
              <option value="fixed">Fixed sell price</option>
              <option value="pct">% on buy</option>
              <option value="flat">Flat margin {unit}</option>
            </select>
          </div>
          <div>
            <span style={lbl}>{method === 'fixed' ? `Sell ${unit}` : method === 'pct' ? 'Margin %' : `Margin ${unit}`}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {method === 'fixed' && (
                <select className="input input--sm" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
                  {(currencies.length ? currencies : [{ code: 'USD' }, { code: 'NZD' }]).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              )}
              <input className="input input--sm" style={{ flex: 1 }} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>
          {method !== 'fixed' && (
            <div>
              <span style={lbl}>Minimum margin (optional)</span>
              <input className="input input--sm" style={{ width: '100%' }} inputMode="decimal" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
          )}
          <div>
            <span style={lbl}>Valid from</span>
            <input type="date" className="input input--sm" style={{ width: '100%' }} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Valid to</span>
            <input type="date" className="input input--sm" style={{ width: '100%' }} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Notes (staff only)</span>
            <input className="input input--sm" style={{ width: '100%' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Agreed with buyer, Q4 tender" />
          </div>
        </div>

        <div style={{ fontSize: 12.5, marginTop: 4, color: belowCost ? '#b42318' : 'var(--muted-foreground)' }}>
          {!hint ? 'Pick a destination to see live buy rates on this lane.'
            : hint.count === 0 ? 'No live rate lines match this lane. Customers will not see this price until a card covers it.'
            : `Buy today: ${hint.currency ?? ''} ${hint.min.toLocaleString('en-NZ')}${hint.max !== hint.min ? ` to ${hint.max.toLocaleString('en-NZ')}` : ''} ${unit} (${hint.count} line${hint.count > 1 ? 's' : ''}).${belowCost ? ' Fixed price is below cost on at least one line.' : ''}`}
        </div>

        <datalist id="cr-origins">{codes.origins.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="cr-dests">{codes.dests.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="cr-carriers">{codes.carriers.map((c) => <option key={c} value={c} />)}</datalist>

        <DialogFooter>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn quotes-page__new-btn" disabled={!canSave || busy} onClick={() => void save()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
