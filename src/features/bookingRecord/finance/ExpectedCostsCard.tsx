import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDown, Plus, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { toNzd, type FxRates } from '@/pages/rates/fx'
import { money, type QuoteResponseLine } from '@/features/quoteBooking/quoteBookingApi'
import {
  deleteCost, fetchFinanceLane, fetchFx, insertCosts, listCosts, updateCost,
  type BookingCost, type CostDraft, type FinanceLane,
} from './bookingCostsApi'
import { quoteLinesToDrafts } from './costMapping'
import { COST_TYPE_LABEL } from './costTypes'
import { missingTypes } from './missingCosts'
import CostRow from './CostRow'
import RateSearchDialog from './RateSearchDialog'

type Props = {
  bookingId: string
  quoteLines: QuoteResponseLine[]
  quoteCurrency: string | null
  quotedBuy: number | null
  onChanged: () => void
}

const iconFilled: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 30, padding: '0 10px' }

export default function ExpectedCostsCard({ bookingId, quoteLines, quoteCurrency, quotedBuy, onChanged }: Props) {
  const [costs, setCosts] = useState<BookingCost[]>([])
  const [lane, setLane] = useState<FinanceLane | null>(null)
  const [rates, setRates] = useState<FxRates>(new Map())
  const [search, setSearch] = useState<{ open: boolean; auto: boolean; n: number }>({ open: false, auto: false, n: 0 })

  const load = useCallback(async () => {
    try {
      const [c, l, r] = await Promise.all([listCosts(bookingId), fetchFinanceLane(bookingId), fetchFx()])
      setCosts(c); setLane(l); setRates(r)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load costs') }
  }, [bookingId])
  useEffect(() => { void load() }, [load])

  const reload = async () => { setCosts(await listCosts(bookingId)); onChanged() }

  async function add(drafts: CostDraft[]) {
    try { await insertCosts(bookingId, drafts, rates); toast.success(`${drafts.length} cost line(s) added`); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Add failed') }
  }
  async function save(id: string, patch: Partial<BookingCost>) {
    try { await updateCost(id, patch, rates); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
  }
  async function remove(c: BookingCost) {
    if (!window.confirm(`Remove ${c.description}?`)) return
    try { await deleteCost(c.id); await reload() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  const fallbackType = lane?.loadType === 'LCL' ? 'co_loader' : 'shipping_line'
  const hasQuoteRows = costs.some((c) => c.source === 'quote')
  const missing = lane ? missingTypes(lane, costs) : []
  const totalNzd = costs.reduce((s, c) => s + Number(c.amount_nzd || 0), 0)
  const quotedNzd = quotedBuy != null ? toNzd(quotedBuy, quoteCurrency, rates, 'buy') : null
  const variance = quotedNzd != null ? totalNzd - quotedNzd : null

  const groups = useMemo(() => {
    const m = new Map<string, BookingCost[]>()
    for (const c of costs) { const k = c.vendor_name || 'No vendor'; m.set(k, [...(m.get(k) ?? []), c]) }
    return [...m.entries()]
  }, [costs])

  return (
    <section className="bk-card">
      <div className="bk-card__toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn--inline" style={iconFilled} title="Add cost line" aria-label="Add cost line"
            onClick={() => void add([{ cost_type: 'other', vendor_name: null, vendor_code: null, charge_group: null, description: 'New cost', qty: 1, unit: null, rate: null, currency: 'NZD', amount: 0, source: 'manual' }])}>
            <Plus size={15} />
          </button>
          {quoteLines.length > 0 && !hasQuoteRows && (
            <button className="icon-btn" title="Import buy lines from quote" aria-label="Import buy lines from quote"
              onClick={() => void add(quoteLinesToDrafts(quoteLines, quoteCurrency, fallbackType))}><FileDown size={15} /></button>
          )}
          <span style={{ fontWeight: 500, marginLeft: 4 }}>Expected costs</span>
        </div>
        <button className="icon-btn" title="Search rate cards" aria-label="Search rate cards" disabled={!lane}
          onClick={() => setSearch((s) => ({ open: true, auto: false, n: s.n + 1 }))}><Search size={15} /></button>
      </div>

      {missing.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid #F1F5F9', background: '#FFFBEB' }}>
          <span className="text-sm">Missing:</span>
          {missing.map((t) => <span key={t} className="bk-pill bk-pill--amber">{COST_TYPE_LABEL[t]}</span>)}
          {missing.some((t) => t !== 'cartage') && (
            <button className="icon-btn" title="Suggest from rate cards" aria-label="Suggest from rate cards"
              onClick={() => setSearch((s) => ({ open: true, auto: true, n: s.n + 1 }))}><Sparkles size={15} /></button>
          )}
        </div>
      )}

      {costs.length === 0 ? (
        <p className="text-muted-foreground" style={{ padding: 16 }}>No expected costs yet. Import from quote, search rate cards, or add a line.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Type</th><th>Vendor</th><th>Charge</th><th>Group</th><th>Ccy</th><th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>NZD</th><th>Source</th><th /></tr>
            </thead>
            <tbody>
              {groups.map(([vendor, rows]) => (
                <VendorGroup key={vendor} vendor={vendor} rows={rows} onSave={save} onDelete={remove} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '10px 16px', borderTop: '1px solid #F1F5F9' }}>
        <span className="text-sm">Expected NZD {money(totalNzd)}</span>
        {quotedNzd != null && <span className="text-sm text-muted-foreground">Quoted buy NZD {money(quotedNzd)}</span>}
        {variance != null && Math.abs(variance) >= 1 && (
          <span className={variance > 0 ? 'bk-pill bk-pill--amber' : 'bk-pill bk-pill--green'}>
            {variance > 0 ? '+' : ''}{money(variance)} vs quote
          </span>
        )}
      </div>

      {lane && search.open && (
        <RateSearchDialog key={search.n} open={search.open} autoPick={search.auto} lane={lane} rates={rates}
          onOpenChange={(v) => setSearch((s) => ({ ...s, open: v }))} onAdd={add} />
      )}
    </section>
  )
}

function VendorGroup({ vendor, rows, onSave, onDelete }: {
  vendor: string; rows: BookingCost[]; onSave: (id: string, p: Partial<BookingCost>) => void; onDelete: (c: BookingCost) => void
}) {
  const sub = rows.reduce((s, c) => s + Number(c.amount_nzd || 0), 0)
  return (
    <>
      <tr style={{ background: '#F8FAFC' }}>
        <td colSpan={6} style={{ fontWeight: 500 }}>{vendor}</td>
        <td style={{ textAlign: 'right' }}>{money(sub)}</td><td colSpan={2} />
      </tr>
      {rows.map((c) => (
        <CostRow key={`${c.id}-${c.amount}-${c.currency}`} cost={c} onSave={(p) => onSave(c.id, p)} onDelete={() => onDelete(c)} />
      ))}
    </>
  )
}
