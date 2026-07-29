import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Trophy, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import IncotermSelect from '../../components/bookings/IncotermSelect'
import QuoteLaneMap from './QuoteLaneMap'
import { useStaffList } from '../../hooks/useStaffList'
import { useCustomerQuoteStats } from '../../hooks/useCustomerQuoteStats'
import { fetchQuote, updateQuote, setQuoteStatus, type QuoteRecord } from './quotesApi'
import {
  fetchQuoteContainers,
  replaceQuoteContainers,
  emptyContainerGroup,
  type QuoteContainerDraft,
  type ContainerSize,
  type ContainerType,
} from './quoteContainersApi'
import { quoteStatusPill } from './quotesTableColumns'
import './quoteDetailPage.css'

const SIZES: { value: ContainerSize; label: string }[] = [
  { value: '20', label: '20ft' }, { value: '40', label: '40ft' },
  { value: '40HC', label: '40ft HC' }, { value: '45HC', label: '45ft HC' },
]
const TYPES: { value: ContainerType; label: string }[] = [
  { value: 'standard', label: 'Standard (dry)' }, { value: 'reefer', label: 'Reefer' },
  { value: 'opentop', label: 'Open top' }, { value: 'flatrack', label: 'Flat rack' },
  { value: 'isotank', label: 'ISO tank' }, { value: 'openside', label: 'Open side' },
]

type Fields = {
  movement_type: string | null
  incoterms: string | null
  customer_po: string | null
  shipper: string | null
  consignee: string | null
  sales_executive_id: string | null
  pricing_executive_id: string | null
}

function pickFields(q: QuoteRecord): Fields {
  return {
    movement_type: q.movement_type,
    incoterms: q.incoterms,
    customer_po: q.customer_po,
    shipper: q.shipper,
    consignee: q.consignee,
    sales_executive_id: q.sales_executive_id,
    pricing_executive_id: q.pricing_executive_id,
  }
}

export default function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { staff } = useStaffList()

  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [status, setStatus] = useState<string>('open')
  const [fields, setFields] = useState<Fields | null>(null)
  const [initial, setInitial] = useState<Fields | null>(null)
  const [groups, setGroups] = useState<QuoteContainerDraft[]>([])
  const [initialGroups, setInitialGroups] = useState<QuoteContainerDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLoads, setSavingLoads] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

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
      setQuote(q); setStatus(q.status)
      setFields(pickFields(q)); setInitial(pickFields(q))
      setGroups(g); setInitialGroups(g)
    } catch {
      toast.error('Failed to load quote'); setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const dirty = useMemo(
    () => Boolean(fields && initial && JSON.stringify(fields) !== JSON.stringify(initial)),
    [fields, initial],
  )
  const loadsDirty = useMemo(
    () => JSON.stringify(groups) !== JSON.stringify(initialGroups),
    [groups, initialGroups],
  )

  function patch(p: Partial<Fields>) { setFields((f) => (f ? { ...f, ...p } : f)) }

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

  function patchGroup(idx: number, p: Partial<QuoteContainerDraft>) {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, ...p } : g)))
  }
  function addGroup() { setGroups((gs) => [...gs, emptyContainerGroup(gs.length)]) }
  function removeGroup(idx: number) { setGroups((gs) => gs.filter((_, i) => i !== idx)) }

  async function handleSave() {
    if (!id || !fields) return
    setSaving(true)
    try {
      await updateQuote(id, fields); setInitial(fields); toast.success('Quote saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function handleSaveLoads() {
    if (!id) return
    setSavingLoads(true)
    try {
      await replaceQuoteContainers(id, groups); setInitialGroups(groups); toast.success('Loads saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save loads')
    } finally { setSavingLoads(false) }
  }

  async function mark(next: string) {
    if (!id) return
    setStatusBusy(true)
    try {
      await setQuoteStatus(id, next); setStatus(next)
      toast.success(`Marked ${next === 'crosswin' ? 'cross win' : next}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status')
    } finally { setStatusBusy(false) }
  }

  if (loading) return <div className="nqd-page"><p className="muted">Loading…</p></div>
  if (!quote || !fields) {
    return (
      <div className="nqd-page">
        <div className="nqd-band nqd-band--pad">
          <p>Quote not found.</p>
          <Link to="/quotes" className="nqd-back">Back to quotes</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="nqd-page">
      <div className="nqd-band nqd-band--pad">
        <Link to="/quotes" className="nqd-back"><ArrowLeft size={14} /> Quotes</Link>
        <div className="nqd-head">
          <div className="nqd-head__left">
            <span className="nqd-name">{quote.customer_name ?? '—'}</span>
            {quoteStatusPill(status)}
            <span className="nqd-sep" />
            <span className="nqd-statpill nqd-statpill--m"><FileText size={13} /> {stats.thisMonth} this month</span>
            <span className="nqd-statpill nqd-statpill--w"><Trophy size={13} /> {stats.converted} won</span>
            <span className="nqd-qno">{quote.quote_no ?? '—'}</span>
          </div>
          <div className="nqd-actions">
            <button className="nqd-btn nqd-btn--ghost" onClick={() => navigate(`/quotes/${id}/edit`)}>
              <Pencil size={14} /> Edit request
            </button>
            <button className="nqd-btn nqd-btn--won" disabled={statusBusy} onClick={() => mark('won')}>Mark won</button>
            <button className="nqd-btn nqd-btn--lost" disabled={statusBusy} onClick={() => mark('lost')}>Mark lost</button>
            <button className="nqd-btn nqd-btn--cross" disabled={statusBusy} onClick={() => mark('crosswin')}>Mark cross win</button>
          </div>
        </div>
      </div>

      <div className="nqd-band nqd-band--pad">
        <div className="nqd-section-head">
          <span className="nqd-section-title">FCL</span>
          <button className="nqd-btn nqd-btn--accent" disabled={!loadsDirty || savingLoads} onClick={handleSaveLoads}>
            {savingLoads ? 'Saving…' : 'Save loads'}
          </button>
        </div>

        <div className="nqd-lane-top">
          <QuoteLaneMap fromCode={quote.from_port_code} toCode={quote.to_port_code} />
        </div>

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
          <div className="nqd-field nqd-field--wide">
            <span className="nqd-field__label">Shipper {fields.movement_type === 'export' && <span className="nqd-field__hint">· defaults to customer</span>}</span>
            <input className="nqd-input" value={fields.shipper ?? ''} onChange={(e) => patch({ shipper: e.target.value || null })} />
          </div>
          <div className="nqd-field nqd-field--wide">
            <span className="nqd-field__label">Consignee {fields.movement_type === 'import' && <span className="nqd-field__hint">· defaults to customer</span>}</span>
            <input className="nqd-input" value={fields.consignee ?? ''} onChange={(e) => patch({ consignee: e.target.value || null })} />
          </div>
        </div>
      </div>

      <div className="nqd-band">
        <div className="nqd-responses">Responses — priced offers land here next</div>
      </div>
    </div>
  )
}
