import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileDown, Loader2, MessageSquareQuote } from 'lucide-react'
import { supabase } from '../../../../supabase'
import { usePorts } from '../../../../hooks/usePorts'
import { placeName } from '../homeModel'
import { allIn, fmtDate, money, type Line, type Product, type RateCard } from '../../../../pages/quotes/rateCards/rateCardModel'

type PortalCard = Omit<RateCard, 'status' | 'parent_id' | 'sales_id' | 'pricing_id' | 'approver_note' | 'submitted_at' | 'approved_at' | 'approved_by' | 'approval_comment' | 'created_at' | 'updated_at'>
  & { sales_name: string | null; sales_email: string | null; lines: Line[] }

const MODE: Record<Product, string> = { FCL: 'FCL', LCL: 'LCL', AIR: 'Air' }
const UNIT: Record<Product, string> = { FCL: 'per container', LCL: 'per w/m', AIR: 'per kg' }

/** Portal > Rates > Your rates: the customer's agreed rate cards, book or quote from a lane. */
export default function PortalYourRates() {
  const navigate = useNavigate()
  const { ports } = usePorts()
  const [cards, setCards] = useState<PortalCard[] | null>(null)
  const [mode, setMode] = useState<'all' | Product>('all')
  const [view, setView] = useState<'all_in' | 'breakdown'>('all_in')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('portal_my_rate_cards').then(({ data }) => setCards((data ?? []) as PortalCard[]))
  }, [])

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
  const current = cards?.find((c) => c.valid_from <= today) ?? null
  const next = cards?.find((c) => c.valid_from > today) ?? null
  const card = current ?? next
  const name = (code: string) => placeName(code, ports)
  const lanes = useMemo(() => (card?.lines ?? []).filter((l) => (mode === 'all' || l.product === mode) &&
    (!q.trim() || `${l.origin_code} ${l.dest_code} ${name(l.origin_code)} ${name(l.dest_code)}`.toLowerCase().includes(q.trim().toLowerCase()))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [card, mode, q, ports])

  async function pdf() {
    if (!card) return
    setBusy(true)
    try {
      const m = await import('../../../../pages/quotes/rateCards/RateCardPdf')
      const full = { ...card, status: 'live', parent_id: null, sales_id: 'x', pricing_id: null, approver_note: null, submitted_at: null,
        approved_at: null, approved_by: null, approval_comment: null, created_at: '', updated_at: '' } as RateCard
      await m.downloadRateCardPdf(full, card.lines.map((l) => ({ ...l, show: true })), { portName: name, staffName: () => card.sales_name ?? 'UB Freight', staffEmail: card.sales_email })
    } finally { setBusy(false) }
  }

  function search(l: Line) {
    const p = new URLSearchParams({ tab: 'search', mode: l.product === 'AIR' ? 'air' : 'sea', from: l.origin_code, to: l.dest_code })
    if (l.product !== 'AIR') p.set('load', l.product)
    if (l.container_type) p.set('container', l.container_type)
    navigate(`/portal/rates?${p.toString()}`)
  }

  if (cards === null) return <div className="pv3-card pv3-rempty"><Loader2 size={20} className="pv3-spin" /><span>Loading your rates…</span></div>
  if (!card) return (
    <div className="pv3-card pv3-rempty pv3-rise">
      <MessageSquareQuote size={28} />
      <div><b>No agreed rate card yet.</b><p>Regular lanes? Ask your account manager for a rate card with your own prices.</p></div>
    </div>
  )

  const fx = card.fx ?? {}
  const modes = [...new Set(card.lines.map((l) => l.product))]
  return (
    <div className="flex flex-col gap-3.5">
      <section className="pv3-card pv3-yr-head pv3-rise">
        <div><span className="pv3-muted">{current ? 'Current rate card' : 'Starts soon'}</span><b>{card.title || 'Your rates'} · {card.ref}</b><span className="pv3-muted">{fmtDate(card.valid_from)} to {fmtDate(card.valid_to)}</span></div>
        {current && next && <div><span className="pv3-muted">Next</span><b>New rates from {fmtDate(next.valid_from)}</b></div>}
        <span className="flex-1" />
        {card.sales_name && <span className="pv3-muted">Questions? {card.sales_name}{card.sales_email ? ` · ${card.sales_email}` : ''}</span>}
        <button type="button" className="pv3-btn" disabled={busy} onClick={() => void pdf()}><FileDown size={15} /> Download PDF</button>
      </section>

      <div className="pv3-yr-bar">
        <input className="pv3-yr-search" placeholder="Search port or country" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search lanes" />
        {modes.length > 1 && (
          <div className="pv3-seg pv3-seg--form" role="group" aria-label="Mode">
            <button type="button" className={mode === 'all' ? 'pv3-seg__on' : ''} onClick={() => setMode('all')}>All</button>
            {modes.map((m) => <button key={m} type="button" className={mode === m ? 'pv3-seg__on' : ''} onClick={() => setMode(m)}>{MODE[m]}</button>)}
          </div>
        )}
        <span className="flex-1" />
        {card.presentation === 'both' && (
          <div className="pv3-seg pv3-seg--form" role="group" aria-label="View">
            <button type="button" className={view === 'all_in' ? 'pv3-seg__on' : ''} onClick={() => setView('all_in')}>All-in</button>
            <button type="button" className={view === 'breakdown' ? 'pv3-seg__on' : ''} onClick={() => setView('breakdown')}>Breakdown</button>
          </div>
        )}
      </div>

      <div className="pv3-yr-grid">
        {lanes.map((l, i) => {
          const ai = allIn(l, fx)
          const fo = card.presentation === 'freight'
          const showBd = card.presentation === 'breakdown' || (card.presentation === 'both' && view === 'breakdown')
          const dp = l.product === 'FCL' ? 0 : 2
          return (
            <article key={i} className="pv3-card pv3-yr-lane pv3-rise" style={{ animationDelay: `${Math.min(i, 12) * 0.02}s` }}>
              <div className="pv3-yr-lane__top">
                <span className="pv3-tag">{MODE[l.product]}</span>
                <b>{name(l.origin_code)} to {name(l.dest_code)}</b>
                <span className="pv3-muted">{l.product === 'FCL' ? l.container_type : UNIT[l.product]}</span>
              </div>
              <div className="pv3-yr-lane__price">
                <span className="pv3-rate__amount">{money(showBd || fo ? l.freight_sell : ai ?? l.freight_sell, l.sell_currency, dp)}</span>
                <span className="pv3-muted">{fo ? 'freight only' : showBd ? 'freight' : 'all-in'}{l.transit_days ? ` · ${l.transit_days} days transit` : ''}</span>
              </div>
              {(showBd || card.presentation === 'both') && (
                <div className="pv3-yr-lane__bd">
                  <span><i>Freight</i>{money(l.freight_sell, l.sell_currency, dp)}</span>
                  <span><i>Origin</i>{money(l.origin_sell, l.origin_currency ?? l.sell_currency)}</span>
                  <span><i>Destination</i>{money(l.dest_sell, l.dest_currency ?? l.sell_currency)}</span>
                </div>
              )}
              <div className="pv3-yr-lane__foot">
                <span className="pv3-muted">Valid to {fmtDate(card.valid_to)}</span>
                <span className="flex-1" />
                <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => search(l)}>Book or quote</button>
              </div>
            </article>
          )
        })}
        {lanes.length === 0 && <p className="pv3-muted">No lanes match.</p>}
      </div>
      <p className="pv3-muted" style={{ fontSize: 12 }}>Your agreed prices apply automatically when you book or search these lanes.{card.excluded ? ` Not included: ${card.excluded}` : ''}</p>
    </div>
  )
}
