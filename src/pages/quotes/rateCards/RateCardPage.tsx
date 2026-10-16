import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, FileDown, Plus, Save } from 'lucide-react'
import { supabase } from '../../../supabase'
import { usePerm } from '../../../access/PermissionsProvider'
import { useStaffList } from '../../../hooks/useStaffList'
import { usePorts } from '../../../hooks/usePorts'
import AddLanesDialog from './AddLanesDialog'
import LocalChargesDialog from './LocalChargesDialog'
import RateCardDetails from './RateCardDetails'
import RateCardLanes from './RateCardLanes'
import RateCardSide from './RateCardSide'
import { RateCardPill } from './RateCardPill'
import {
  cardWatch, computeSell, deleteLines, getCard, laneKey, listEvents, logEvent, marginRules, publishCard, requestChanges,
  reviseCard, saveLines, submitCard, todayIso, updateCard, viewStatus, withdrawCard,
  type CardEvent, type CardPatch, type Line, type MarginMethod, type Product, type RateCard, type Rule, type Watch,
} from './rateCardsApi'

type Live = Map<string, { value: number; currency: string | null; ref: string | null }>

/** One customer rate card: build, price, approve, publish. */
export default function RateCardPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const canEdit = usePerm('customer_rates', 'edit')
  const canApprove = usePerm('customer_rates_approve', 'edit')
  const { staff } = useStaffList()
  const { ports } = usePorts()
  const [card, setCard] = useState<RateCard | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [rules, setRules] = useState<Partial<Record<Product, Rule>>>({})
  const [watch, setWatch] = useState<Map<string, Watch>>(new Map())
  const [live, setLive] = useState<Live>(new Map())
  const [events, setEvents] = useState<CardEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [chargesOpen, setChargesOpen] = useState(false)
  const [bulk, setBulk] = useState<{ method: MarginMethod; value: string }>({ method: 'pct', value: '' })

  const load = useCallback(async () => {
    try {
      const { card: c, lines: l } = await getCard(id)
      setCard(c); setLines(l); setRemoved([]); setDirty(false)
      const [mr, w, ev, lr] = await Promise.all([
        marginRules(c.account_id), cardWatch(id), listEvents(id),
        supabase.from('rate_margin_rules').select('product, origin_code, dest_code, container_type, value, currency_code, notes, customer_rate_card_id, valid_from, valid_to')
          .eq('account_id', c.account_id).eq('method', 'fixed').eq('active', true),
      ])
      const byP: Partial<Record<Product, Rule>> = {}
      for (const r of mr) if (!byP[r.product as Product]) byP[r.product as Product] = { method: r.method, value: Number(r.value), min_margin: r.min_margin }
      setRules(byP)
      setWatch(new Map(w.map((x) => [x.line_id, x])))
      setEvents(ev)
      const t = todayIso(); const m: Live = new Map()
      for (const r of (lr.data ?? []) as Record<string, any>[]) {
        if (r.customer_rate_card_id === id || (r.valid_from && r.valid_from > t) || (r.valid_to && r.valid_to < t)) continue
        m.set(laneKey({ product: r.product, origin_code: r.origin_code ?? '', dest_code: r.dest_code ?? '', container_type: r.container_type }), { value: Number(r.value), currency: r.currency_code, ref: r.notes })
      }
      setLive(m)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load rate card')
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const editable = !!card && canEdit && (card.status === 'draft' || card.status === 'changes')
  const existing = useMemo(() => new Set(lines.map(laneKey)), [lines])
  const portName = useCallback((code: string) => ports.get(code)?.name ?? code, [ports])
  const staffName = useCallback((uid: string | null) => staff.find((s) => s.user_id === uid)?.name ?? '–', [staff])

  const patchCard = (p: CardPatch) => { setCard((c) => (c ? { ...c, ...p } : c)); setDirty(true) }
  const patchLine = (i: number, p: Partial<Line>) => { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l))); setDirty(true) }
  const removeLine = (i: number) => {
    const l = lines[i]; if (l.id) setRemoved((r) => [...r, l.id!])
    setLines((ls) => ls.filter((_, j) => j !== i)); setDirty(true)
  }
  const applyAll = (match: (l: Line) => boolean, patch: Partial<Line>) => { setLines((ls) => ls.map((l) => (match(l) ? { ...l, ...patch } : l))); setDirty(true) }

  function applyBulk() {
    const v = bulk.value.trim() === '' ? null : Number(bulk.value)
    if (bulk.method !== 'rule' && v == null) { toast.error('Enter a margin'); return }
    setLines((ls) => ls.map((l) => { const n = { ...l, margin_method: bulk.method, margin_value: v }; return { ...n, freight_sell: computeSell(n, rules[l.product] ?? null) } }))
    setDirty(true)
  }

  async function save(quiet = false): Promise<boolean> {
    if (!card) return false
    setBusy(true)
    try {
      await updateCard(card.id, { title: card.title, valid_from: card.valid_from, valid_to: card.valid_to, presentation: card.presentation, fx: card.fx,
        sales_id: card.sales_id, pricing_id: card.pricing_id, included: card.included, excluded: card.excluded, terms: card.terms })
      await deleteLines(removed)
      await saveLines(card.id, lines.map((l, i) => ({ ...l, sort: i })))
      if (!quiet) { await logEvent(card.id, 'saved'); toast.success('Saved') }
      await load()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed'); return false
    } finally { setBusy(false) }
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try { await fn(); toast.success(ok); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  async function pdf(kind: 'view' | 'download') {
    if (!card) return
    setBusy(true)
    try {
      const m = await import('./RateCardPdf')
      await (kind === 'view' ? m.previewRateCardPdf : m.downloadRateCardPdf)(card, lines, { portName, staffName })
      if (kind === 'download') await logEvent(card.id, 'pdf')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'PDF failed') }
    finally { setBusy(false) }
  }

  if (!card) return <div className="quotes-page"><div className="card quotes-page__card"><p className="text-muted-foreground pad-inline">Loading…</p></div></div>
  const vs = viewStatus(card)

  return (
    <div className="quotes-page">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <nav aria-label="Breadcrumb" className="flex gap-1.5 text-[12px] text-[#5B6474]"><Link to="/quotes">Quotes</Link><span>/</span><Link to="/quotes?tab=rates">Customer rates</Link><span>/</span><span className="font-mono">{card.ref}</span></nav>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-[21px] font-medium tracking-[-0.01em]">{card.customer}{card.title ? ` · ${card.title}` : ''}</h1>
            <RateCardPill status={vs} />
            {card.version > 1 && <span className="text-[12px] text-[#5B6474]">v{card.version}</span>}
            <span className="flex-1" />
            <button type="button" className="btn btn--inline" disabled={busy || !lines.length} onClick={() => void pdf('view')}><Eye size={14} /> Preview PDF</button>
            <button type="button" className="btn btn--inline" disabled={busy || !lines.length} onClick={() => void pdf('download')}><FileDown size={14} /> Download</button>
            {editable && <button type="button" className="btn quotes-page__new-btn" disabled={busy || !dirty} onClick={() => void save()}><Save size={14} /> {dirty ? 'Save draft' : 'Saved'}</button>}
          </div>
        </header>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[999_1_820px] flex-col gap-4">
            <RateCardDetails card={card} editable={editable} staff={staff} onChange={patchCard} />
            <section className="cp-card">
              <div className="cp-card-head">
                <h3 className="cp-card-title">Lanes and rates</h3>
                {editable && <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn--inline" onClick={() => setChargesOpen(true)} disabled={!lines.length}>Set local charges</button>
                  <button type="button" className="btn quotes-page__new-btn" onClick={() => setAddOpen(true)}><Plus size={14} /> Add lanes</button>
                </div>}
              </div>
              {editable && lines.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5 border-y border-[#F0F1F4] bg-[#FCFCFD] px-[18px] py-2.5 text-[12.5px]">
                  <span className="text-[#5B6474]">Margin for all lanes</span>
                  <select className="h-8 rounded-md border border-[#E6E8EE] px-2" value={bulk.method} onChange={(e) => setBulk((b) => ({ ...b, method: e.target.value as MarginMethod }))}>
                    <option value="rule">Customer rule</option><option value="pct">% on buy</option><option value="flat">$ per unit</option></select>
                  {bulk.method !== 'rule' && <input className="h-8 w-20 rounded-md border border-[#E6E8EE] px-2 text-right" value={bulk.value} onChange={(e) => setBulk((b) => ({ ...b, value: e.target.value }))} />}
                  <button type="button" className="btn btn--inline" onClick={applyBulk}>Apply</button>
                  <span className="text-[#5B6474]">{rules.FCL || rules.LCL || rules.AIR ? `Rule: ${(['FCL', 'LCL', 'AIR'] as Product[]).filter((p) => rules[p]).map((p) => `${p} ${rules[p]!.method === 'pct' ? `${rules[p]!.value}%` : `+${rules[p]!.value}`}${rules[p]!.min_margin ? ` min ${rules[p]!.min_margin}` : ''}`).join(' · ')}` : 'No margin rule set for this customer'}</span>
                </div>
              )}
              <RateCardLanes lines={lines} editable={editable} rules={rules} fx={card.fx ?? {}} watch={watch} liveNow={live} onChange={patchLine} onRemove={removeLine} />
            </section>
          </div>
          <RateCardSide card={card} lines={lines} watch={watch} events={events} staffName={staffName} canEdit={canEdit} canApprove={canApprove} busy={busy}
            onSubmit={(note) => void (async () => { if (dirty && !(await save(true))) return; await run(() => submitCard(card.id, note), 'Sent for approval') })()}
            onApprove={(c, ack) => void run(() => publishCard(card.id, c, ack), 'Published. Contract rates are live.')}
            onChanges={(c) => void run(() => requestChanges(card.id, c), 'Sent back to sales')}
            onRevise={(renew) => void (async () => { setBusy(true); try { navigate(`/quotes/rate-cards/${await reviseCard(card.id, renew)}`) } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) } })()}
            onWithdraw={() => { if (window.confirm('Withdraw this rate card? Its contract rates stop today.')) void run(() => withdrawCard(card.id), 'Withdrawn') }} />
        </div>
      </div>
      <AddLanesDialog open={addOpen} onOpenChange={setAddOpen} rules={rules} existing={existing} nextSort={lines.length}
        onAdd={(ls) => { setLines((x) => [...x, ...ls]); setDirty(true) }} />
      <LocalChargesDialog open={chargesOpen} onOpenChange={setChargesOpen} lines={lines} onApply={applyAll} />
    </div>
  )
}
