import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Trophy, Pencil, Plus, X, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import IncotermSelect from '../../components/bookings/IncotermSelect'
import CustomerPicker, { type CustomerPickerValue } from '../../components/bookings/CustomerPicker'
import SeaPortSelect from '../../components/bookings/SeaPortSelect'
import IataPortSelect from '../../components/bookings/IataPortSelect'
import QuoteLaneMap from './QuoteLaneMap'
import QuoteCargoLines from './QuoteCargoLines'
import { useStaffList } from '../../hooks/useStaffList'
import { useCustomerQuoteStats } from '../../hooks/useCustomerQuoteStats'
import { fetchQuote, updateQuote, setQuoteStatus, type QuoteRecord } from './quotesApi'
import {
  fetchQuoteContainers, replaceQuoteContainers, emptyContainerGroup,
  type QuoteContainerDraft, type ContainerSize, type ContainerType,
} from './quoteContainersApi'
import {
  fetchQuoteCargo, saveQuoteCargo, newQuoteCargoLine, type QuoteCargoLine,
} from './quoteCargoApi'
import { quoteStatusPill } from './quotesTableColumns'
import { DG_CLASS_OPTIONS } from './quoteDgClasses'
import QuoteResponsesPanel from './QuoteResponsesPanel'
import PartyPicker from './PartyPicker'
import ExternalNotesField from './ExternalNotesField'
import './quoteDetailPage.css'

const SIZES: { value: ContainerSize; label: string }[] = [
  { value: '20', label: '20ft' }, { value: '20HC', label: '20ft HC' },
  { value: '40', label: '40ft' }, { value: '40HC', label: '40ft HC' },
]
const TYPES: { value: ContainerType; label: string }[] = [
  { value: 'standard', label: 'Standard (dry)' }, { value: 'reefer', label: 'Reefer' },
  { value: 'opentop', label: 'Open top' }, { value: 'flatrack', label: 'Flat rack' },
  { value: 'isotank', label: 'ISO tank' }, { value: 'openside', label: 'Open side' },
]
const CURRENCIES = ['NZD', 'USD', 'AUD', 'EUR', 'GBP', 'CNY', 'FJD', 'SGD']

function quoteIsAir(type: string | null, mode: string | null): boolean {
  return (type ?? '').toUpperCase() === 'AIR' || /air/i.test(mode ?? '')
}
function quoteIsLcl(type: string | null): boolean {
  return (type ?? '').toUpperCase() === 'LCL'
}

type Fields = {
  movement_type: string | null
  shipping_line: string | null
  service_type: string | null
  incoterms: string | null
  customer_po: string | null
  shipper: string | null
  consignee: string | null
  shipper_address: string | null
  consignee_address: string | null
  sales_executive_id: string | null
  pricing_executive_id: string | null
  internal_notes: string | null
  external_notes: string | null
}
type Cargo = {
  cargo_value: number | null
  cargo_value_currency: string | null
  need_insurance: boolean
  need_refrigeration: boolean
  reefer_temp_c: number | null
  is_hazardous: boolean
  dg_un_number: string | null
  dg_class: string | null
  stackable: boolean
}

function pickFields(q: QuoteRecord): Fields {
  return {
    movement_type: q.movement_type, incoterms: q.incoterms, customer_po: q.customer_po,
    shipping_line: q.shipping_line, service_type: q.service_type,
    shipper: q.shipper, consignee: q.consignee,
    shipper_address: q.shipper_address, consignee_address: q.consignee_address,
    sales_executive_id: q.sales_executive_id, pricing_executive_id: q.pricing_executive_id,
    internal_notes: q.internal_notes, external_notes: q.external_notes,
  }
}
function pickCargo(q: QuoteRecord): Cargo {
  return {
    cargo_value: q.cargo_value, cargo_value_currency: q.cargo_value_currency ?? 'NZD',
    need_insurance: q.need_insurance, need_refrigeration: q.need_refrigeration,
    reefer_temp_c: q.reefer_temp_c, is_hazardous: q.is_hazardous,
    dg_un_number: q.dg_un_number, dg_class: q.dg_class,
    stackable: q.stackable === 'true',
  }
}

async function fetchCustomerAddress(accountId: string): Promise<string> {
  const { data } = await supabase
    .from('customers')
    .select('address1,address2,address3,city,country')
    .eq('account_id', accountId)
    .maybeSingle()
  if (!data) return ''
  return [data.address1, data.address2, data.address3, data.city, data.country]
    .filter(Boolean).join(', ')
}

export default function QuoteDetailPage() {
  const { id } = useParams()
  const { staff } = useStaffList()

  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [status, setStatus] = useState<string>('open')
  const [fields, setFields] = useState<Fields | null>(null)
  const [initial, setInitial] = useState<Fields | null>(null)
  const [cargo, setCargo] = useState<Cargo | null>(null)
  const [initialCargo, setInitialCargo] = useState<Cargo | null>(null)
  const [groups, setGroups] = useState<QuoteContainerDraft[]>([])
  const [initialGroups, setInitialGroups] = useState<QuoteContainerDraft[]>([])
  const [cargoLines, setCargoLines] = useState<QuoteCargoLine[]>([])
  const [initialCargoLines, setInitialCargoLines] = useState<QuoteCargoLine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingCargo, setSavingCargo] = useState(false)
  const [savingLoads, setSavingLoads] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [editingPorts, setEditingPorts] = useState(false)

  const { stats } = useCustomerQuoteStats(quote?.customer_account_id)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [q, cons] = await Promise.all([fetchQuote(id), fetchQuoteContainers(id)])
      if (!q) { setQuote(null); return }
      const g = cons.map((c) => ({
        ord: c.ord, container_size: c.container_size, container_type: c.container_type,
        qty: c.qty, weight_per_container_mt: c.weight_per_container_mt, commodity: c.commodity,
      }))
      let cl: QuoteCargoLine[] = []
      if (quoteIsLcl(q.shipment_type) || quoteIsAir(q.shipment_type, q.shipment_mode)) {
        const fetched = await fetchQuoteCargo(id)
        cl = fetched.length ? fetched : [newQuoteCargoLine(0)]
      }
      const f = pickFields(q)
      if (q.customer_account_id && (!f.shipper_address || !f.consignee_address)) {
        const addr = await fetchCustomerAddress(q.customer_account_id)
        if (addr) {
          if (!f.shipper_address) f.shipper_address = addr
          if (!f.consignee_address) f.consignee_address = addr
        }
      }
      setQuote(q); setStatus(q.status)
      setFields(f); setInitial(f)
      setCargo(pickCargo(q)); setInitialCargo(pickCargo(q))
      setGroups(g); setInitialGroups(g)
      setCargoLines(cl); setInitialCargoLines(cl)
    } catch {
      toast.error('Failed to load quote'); setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const isAir = quoteIsAir(quote?.shipment_type ?? null, quote?.shipment_mode ?? null)
  const isLcl = quoteIsLcl(quote?.shipment_type ?? null)
  const usesCargoLines = isLcl || isAir

  const dirty = useMemo(
    () => Boolean(fields && initial && JSON.stringify(fields) !== JSON.stringify(initial)),
    [fields, initial])
  const cargoDirty = useMemo(
    () => Boolean(cargo && initialCargo && JSON.stringify(cargo) !== JSON.stringify(initialCargo)),
    [cargo, initialCargo])
  const loadsDirty = useMemo(
    () => JSON.stringify(groups) !== JSON.stringify(initialGroups),
    [groups, initialGroups])
  const cargoLinesDirty = useMemo(
    () => JSON.stringify(cargoLines) !== JSON.stringify(initialCargoLines),
    [cargoLines, initialCargoLines])

  function patch(p: Partial<Fields>) { setFields((f) => (f ? { ...f, ...p } : f)) }
  function patchCargo(p: Partial<Cargo>) { setCargo((c) => (c ? { ...c, ...p } : c)) }

  function onMovementChange(v: string) {
    setFields((f) => {
      if (!f) return f
      const next: Fields = { ...f, movement_type: v || null }
      const cust = quote?.customer_name ?? null
      if (v === 'export' && !f.shipper && cust) next.shipper = cust
      if (v === 'import' && !f.consignee && cust) next.consignee = cust
      return next
    })
  }

  async function onCustomerChange(v: CustomerPickerValue | null) {
    if (!v || !id) return
    try {
      await updateQuote(id, { customer_account_id: v.account_id, customer_name: v.name })
      setQuote((q) => (q ? { ...q, customer_account_id: v.account_id, customer_name: v.name } : q))
      setEditingCustomer(false); toast.success('Customer updated')
    } catch { toast.error('Failed to update customer') }
  }

  async function savePort(which: 'from' | 'to', code: string) {
    if (!id) return
    const p = which === 'from' ? { from_port_code: code || null } : { to_port_code: code || null }
    try {
      await updateQuote(id, p)
      setQuote((q) => (q ? { ...q, ...p } : q))
    } catch { toast.error('Failed to update port') }
  }

  function patchGroup(idx: number, p: Partial<QuoteContainerDraft>) {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, ...p } : g)))
  }
  function addGroup() { setGroups((gs) => [...gs, emptyContainerGroup(gs.length)]) }
  function removeGroup(idx: number) { setGroups((gs) => gs.filter((_, i) => i !== idx)) }

  function addCargoLine() { setCargoLines((ls) => [...ls, newQuoteCargoLine(ls.length)]) }

  async function handleSave() {
    if (!id || !fields) return
    setSaving(true)
    try { await updateQuote(id, fields); setInitial(fields); toast.success('Details saved') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }
  async function handleSaveCargo() {
    if (!id || !cargo) return
    setSavingCargo(true)
    try {
      await updateQuote(id, { ...cargo, stackable: cargo.stackable ? 'true' : 'false' })
      setInitialCargo(cargo); toast.success('Cargo saved')
    }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save cargo') }
    finally { setSavingCargo(false) }
  }
  async function handleSaveLoads() {
    if (!id) return
    setSavingLoads(true)
    try {
      if (usesCargoLines) { await saveQuoteCargo(id, cargoLines); setInitialCargoLines(cargoLines) }
      else { await replaceQuoteContainers(id, groups); setInitialGroups(groups) }
      toast.success('Loads saved')
    }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save loads') }
    finally { setSavingLoads(false) }
  }
  async function mark(next: string) {
    if (!id) return
    setStatusBusy(true)
    try {
      await setQuoteStatus(id, next); setStatus(next)
      toast.success(`Marked ${next === 'crosswin' ? 'cross win' : next}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update status') }
    finally { setStatusBusy(false) }
  }

  if (loading) return <div className="nqd-page"><p className="muted">Loading…</p></div>
  if (!quote || !fields || !cargo) {
    return (
      <div className="nqd-page">
        <div className="nqd-band nqd-band--pad">
          <p>Quote not found.</p>
          <Link to="/quotes" className="nqd-back">Back to quotes</Link>
        </div>
      </div>
    )
  }

  const modeLabel = isAir ? 'Air' : isLcl ? 'LCL' : 'FCL'
  const laneMode: 'fcl' | 'lcl' | 'air' = isAir ? 'air' : isLcl ? 'lcl' : 'fcl'

  return (
    <div className="nqd-page">
      <div className="nqd-band nqd-band--pad">
        <Link to="/quotes" className="nqd-back"><ArrowLeft size={14} /> Quotes</Link>
        <div className="nqd-head">
          <div className="nqd-head__left">
            {editingCustomer ? (
              <div style={{ minWidth: 280 }}>
                <CustomerPicker
                  compact
                  value={quote.customer_account_id ? { account_id: quote.customer_account_id, name: quote.customer_name ?? '' } : null}
                  onChange={onCustomerChange}
                />
              </div>
            ) : (
              <>
                <span className="nqd-name">{quote.customer_name ?? '—'}</span>
                <button className="nqd-editicon" onClick={() => setEditingCustomer(true)} aria-label="Change customer"><Pencil size={13} /></button>
              </>
            )}
            {quoteStatusPill(status)}
            <span className="nqd-sep" />
            <span className="nqd-statpill nqd-statpill--m"><FileText size={13} /> {stats.thisMonth} this month</span>
            <span className="nqd-statpill nqd-statpill--w"><Trophy size={13} /> {stats.converted} won</span>
            <span className="nqd-qno">{quote.quote_no ?? '—'}</span>
          </div>
          <div className="nqd-actions">
            <button className="nqd-btn nqd-btn--won" disabled={statusBusy} onClick={() => mark('won')}>Mark won</button>
            <button className="nqd-btn nqd-btn--lost" disabled={statusBusy} onClick={() => mark('lost')}>Mark lost</button>
            <button className="nqd-btn nqd-btn--cross" disabled={statusBusy} onClick={() => mark('crosswin')}>Mark cross win</button>
          </div>
        </div>
      </div>

      <div className="nqd-band nqd-band--pad">
        <div className="nqd-section-head">
          <div className="nqd-fclhead">
            <span className="nqd-fclpill">{modeLabel}</span>
            {editingPorts ? (
              <div className="nqd-portedit">
                {isAir ? (
                  <>
                    <IataPortSelect value={quote.from_port_code ?? ''} onChange={(v) => savePort('from', v)} />
                    <ArrowRight size={16} color="#94a3b8" />
                    <IataPortSelect value={quote.to_port_code ?? ''} onChange={(v) => savePort('to', v)} />
                  </>
                ) : (
                  <>
                    <SeaPortSelect value={quote.from_port_code ?? ''} onChange={(v) => savePort('from', v)} placeholder="From port" />
                    <ArrowRight size={16} color="#94a3b8" />
                    <SeaPortSelect value={quote.to_port_code ?? ''} onChange={(v) => savePort('to', v)} placeholder="To port" />
                  </>
                )}
                <button className="nqd-editicon" onClick={() => setEditingPorts(false)} aria-label="Done"><Check size={16} /></button>
              </div>
            ) : (
              <>
                <QuoteLaneMap fromCode={quote.from_port_code} toCode={quote.to_port_code} mode={laneMode} />
                <button className="nqd-editicon" onClick={() => setEditingPorts(true)} aria-label="Change ports"><Pencil size={13} /></button>
              </>
            )}
          </div>
          <button
            className="nqd-btn nqd-btn--accent"
            disabled={(usesCargoLines ? !cargoLinesDirty : !loadsDirty) || savingLoads}
            onClick={handleSaveLoads}
          >
            {savingLoads ? 'Saving…' : 'Save loads'}
          </button>
        </div>

        {usesCargoLines ? (
          <>
            <QuoteCargoLines lines={cargoLines} mode={isAir ? 'air' : 'sea'} onChange={setCargoLines} />
            <button className="nqd-addgrp" onClick={addCargoLine}><Plus size={15} /> Add cargo line</button>
          </>
        ) : (
          <>
            {groups.length === 0 && <p className="nqd-empty">No containers yet.</p>}
            {groups.map((g, i) => (
              <div className="nqd-cg" key={i}>
                <div className="nqd-cg__head">
                  <span className="nqd-cg__title">Group {i + 1}</span>
                  <button className="nqd-cg__rm" onClick={() => removeGroup(i)} aria-label="Remove group"><X size={15} /></button>
                </div>
                <div className="nqd-cg__grid">
                  <div className="nqd-field">
                    <span className="nqd-field__label">Size</span>
                    <select className="nqd-input" value={g.container_size} onChange={(e) => patchGroup(i, { container_size: e.target.value as ContainerSize })}>
                      {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="nqd-field">
                    <span className="nqd-field__label">Type</span>
                    <select className="nqd-input" value={g.container_type} onChange={(e) => patchGroup(i, { container_type: e.target.value as ContainerType })}>
                      {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="nqd-field">
                    <span className="nqd-field__label">Qty</span>
                    <input className="nqd-input" type="number" min={1} value={g.qty} onChange={(e) => patchGroup(i, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div className="nqd-field">
                    <span className="nqd-field__label">Weight / ctr (MT)</span>
                    <input className="nqd-input" type="number" value={g.weight_per_container_mt ?? ''} onChange={(e) => patchGroup(i, { weight_per_container_mt: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                  <div className="nqd-field">
                    <span className="nqd-field__label">Commodity</span>
                    <input className="nqd-input" type="text" placeholder="General" value={g.commodity ?? ''} onChange={(e) => patchGroup(i, { commodity: e.target.value || null })} />
                  </div>
                </div>
              </div>
            ))}
            <button className="nqd-addgrp" onClick={addGroup}><Plus size={15} /> Add another group</button>
          </>
        )}
      </div>

      <div className="nqd-band nqd-band--pad">
        <div className="nqd-section-head">
          <span className="nqd-section-title">Details</span>
          <button className="nqd-btn nqd-btn--accent" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="nqd-grid">
          <div className="nqd-field">
            <span className="nqd-field__label">Shipment type</span>
            <select className="nqd-input" value={fields.movement_type ?? ''} onChange={(e) => onMovementChange(e.target.value)}>
              <option value="">—</option><option value="import">Import</option><option value="export">Export</option>
            </select>
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Incoterms</span>
            <IncotermSelect value={fields.incoterms ?? ''} onChange={(v) => patch({ incoterms: v || null })} />
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Movement type</span>
            <select className="nqd-input" value={fields.service_type ?? ''} onChange={(e) => patch({ service_type: e.target.value || null })}>
              <option value="">—</option>
              <option value="Door to Door">Door to Door</option>
              <option value="Port to Port">Port to Port</option>
              <option value="Door to Port">Door to Port</option>
              <option value="Port to Door">Port to Door</option>
            </select>
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Customer ref #</span>
            <input className="nqd-input" value={fields.customer_po ?? ''} onChange={(e) => patch({ customer_po: e.target.value || null })} />
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Sales executive</span>
            <select className="nqd-input" value={fields.sales_executive_id ?? ''} onChange={(e) => patch({ sales_executive_id: e.target.value || null })}>
              <option value="">—</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Pricing executive</span>
            <select className="nqd-input" value={fields.pricing_executive_id ?? ''} onChange={(e) => patch({ pricing_executive_id: e.target.value || null })}>
              <option value="">—</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="nqd-parties">
          <div className="nqd-field">
            <span className="nqd-field__label">Shipper {fields.movement_type === 'export' && <span className="nqd-field__hint">· defaults to customer</span>}</span>
            <PartyPicker
              kind="shipper"
              name={fields.shipper ?? ''}
              address={fields.shipper_address ?? ''}
              onNameChange={(v) => patch({ shipper: v || null })}
              onPick={(v) => patch({ shipper: v.name || null, shipper_address: v.address || null })}
            />
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Consignee {fields.movement_type === 'import' && <span className="nqd-field__hint">· defaults to customer</span>}</span>
            <PartyPicker
              kind="consignee"
              name={fields.consignee ?? ''}
              address={fields.consignee_address ?? ''}
              onNameChange={(v) => patch({ consignee: v || null })}
              onPick={(v) => patch({ consignee: v.name || null, consignee_address: v.address || null })}
            />
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Shipper address</span>
            <textarea className="nqd-input nqd-textarea" rows={2} value={fields.shipper_address ?? ''} onChange={(e) => patch({ shipper_address: e.target.value || null })} />
          </div>
          <div className="nqd-field">
            <span className="nqd-field__label">Consignee address</span>
            <textarea className="nqd-input nqd-textarea" rows={2} value={fields.consignee_address ?? ''} onChange={(e) => patch({ consignee_address: e.target.value || null })} />
          </div>
        </div>
      </div>

      <div className="nqd-band nqd-band--pad">
        <div className="nqd-section-head">
          <span className="nqd-section-title">Cargo</span>
          <button className="nqd-btn nqd-btn--accent" disabled={!cargoDirty || savingCargo} onClick={handleSaveCargo}>
            {savingCargo ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="nqd-cargo">
          <div className="nqd-cargo__value">
            <div className="nqd-field">
              <span className="nqd-field__label">Currency</span>
              <select className="nqd-input" value={cargo.cargo_value_currency ?? 'NZD'} onChange={(e) => patchCargo({ cargo_value_currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="nqd-field">
              <span className="nqd-field__label">Value</span>
              <input className="nqd-input" type="number" value={cargo.cargo_value ?? ''} onChange={(e) => patchCargo({ cargo_value: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
          </div>

          <div className="nqd-cargo__flags">
            <label className="nqd-check">
              <input type="checkbox" checked={cargo.need_insurance} onChange={(e) => patchCargo({ need_insurance: e.target.checked })} /> Insurance
            </label>

            <label className="nqd-check">
              <input type="checkbox" checked={cargo.need_refrigeration} onChange={(e) => patchCargo({ need_refrigeration: e.target.checked, reefer_temp_c: e.target.checked ? cargo.reefer_temp_c : null })} /> Reefer
            </label>
            {cargo.need_refrigeration && (
              <div className="nqd-field nqd-cond">
                <span className="nqd-field__label">Temperature (°C)</span>
                <input className="nqd-input" type="number" value={cargo.reefer_temp_c ?? ''} onChange={(e) => patchCargo({ reefer_temp_c: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            )}

            <label className="nqd-check">
              <input type="checkbox" checked={cargo.is_hazardous} onChange={(e) => patchCargo({ is_hazardous: e.target.checked, dg_un_number: e.target.checked ? cargo.dg_un_number : null, dg_class: e.target.checked ? cargo.dg_class : null })} /> Dangerous goods
            </label>
            {cargo.is_hazardous && (
              <div className="nqd-cond nqd-cond--dg">
                <div className="nqd-field">
                  <span className="nqd-field__label">UN number</span>
                  <input className="nqd-input" placeholder="e.g. UN1263" value={cargo.dg_un_number ?? ''} onChange={(e) => patchCargo({ dg_un_number: e.target.value || null })} />
                </div>
                <div className="nqd-field">
                  <span className="nqd-field__label">Class</span>
                  <select className="nqd-input" value={cargo.dg_class ?? ''} onChange={(e) => patchCargo({ dg_class: e.target.value || null })}>
                    <option value="">—</option>
                    {DG_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            <label className="nqd-check">
              <input type="checkbox" checked={cargo.stackable} onChange={(e) => patchCargo({ stackable: e.target.checked })} /> Stackable
            </label>
          </div>
        </div>
      </div>

      <div className="nqd-band">
        <QuoteResponsesPanel quoteId={quote.id} />
      </div>

      <div className="nqd-band nqd-band--pad">
        <div className="nqd-section-head">
          <span className="nqd-section-title">Notes</span>
          <button className="nqd-btn nqd-btn--accent" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="nqd-notes">
          <div className="nqd-field">
            <span className="nqd-field__label">Internal notes (not shown on quote)</span>
            <textarea
              className="nqd-input nqd-textarea nqd-textarea--scroll"
              value={fields.internal_notes ?? ''}
              onChange={(e) => patch({ internal_notes: e.target.value || null })}
            />
          </div>
          <ExternalNotesField
            value={fields.external_notes ?? ''}
            onChange={(v) => patch({ external_notes: v || null })}
          />
        </div>
      </div>
    </div>
  )
}
