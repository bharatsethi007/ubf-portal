import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useStaffList } from '../../../hooks/useStaffList'
import { usePerm } from '../../../access/PermissionsProvider'
import NewRateCardDialog from './NewRateCardDialog'
import FromSetupDialog from './FromSetupDialog'
import SetupCardPeek from './SetupCardPeek'
import { RateCardPill } from './RateCardPill'
import { fmtDate, listCards, listSharedCards, todayIso, viewStatus, type CardListRow, type SharedCard } from './rateCardsApi'

const FILTERS: { key: string; label: string; test: (s: string) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'draft', label: 'Draft', test: (s) => s === 'draft' || s === 'changes' },
  { key: 'pending', label: 'Waiting approval', test: (s) => s === 'pending' },
  { key: 'live', label: 'Live', test: (s) => s === 'live' || s === 'scheduled' || s === 'expiring' },
  { key: 'expiring', label: 'Expiring', test: (s) => s === 'expiring' },
  { key: 'expired', label: 'Expired', test: (s) => s === 'expired' || s === 'superseded' },
]

function sharedView(c: SharedCard): string {
  const t = todayIso()
  if (c.status === 'draft') return 'draft'
  if (c.status === 'expired' || (c.valid_to && c.valid_to < t)) return 'expired'
  if (c.valid_from && c.valid_from > t) return 'scheduled'
  return 'live'
}

const tile = 'flex min-w-0 flex-col gap-0.5 border-r border-[#F0F1F4] px-4 py-3 last:border-r-0'
const lbl = 'text-[11.5px] text-[#5B6474]'

/** Quotes > Customer rates: every customer rate card, with approval and buy-rate watch. */
export default function CustomerRatesTab({ search }: { search: string }) {
  const navigate = useNavigate()
  const canAdd = usePerm('customer_rates', 'add')
  const { staff } = useStaffList()
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.user_id, s.name])), [staff])
  const [rows, setRows] = useState<CardListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [newOpen, setNewOpen] = useState(false)
  const [shared, setShared] = useState<SharedCard[]>([])
  const [source, setSource] = useState<'all' | 'rc' | 'setup'>('all')
  const [peek, setPeek] = useState<(SharedCard & { view: string }) | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [convert, setConvert] = useState<SharedCard[] | null>(null)

  useEffect(() => {
    listCards().then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false))
    listSharedCards().then(setShared).catch(() => setShared([]))
  }, [])
  const sharedRows = useMemo(() => shared.map((c) => ({ ...c, view: sharedView(c) })), [shared])
  const sharedShown = sharedRows.filter((c) => source !== 'rc' && FILTERS.find((f) => f.key === filter)!.test(c.view) &&
    (!search.trim() || `${c.title} ${c.vendor} ${c.customers.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())))

  const withView = useMemo(() => rows.map((r) => ({ ...r, view: viewStatus(r) })), [rows])
  const q = search.trim().toLowerCase()
  const shown = withView.filter((r) =>
    FILTERS.find((f) => f.key === filter)!.test(r.view) &&
    (!q || `${r.ref} ${r.customer} ${r.title}`.toLowerCase().includes(q)))
  const count = (k: string) => (source === 'setup' ? 0 : withView.filter((r) => FILTERS.find((f) => f.key === k)!.test(r.view)).length)
    + (source === 'rc' ? 0 : sharedRows.filter((r) => FILTERS.find((f) => f.key === k)!.test(r.view)).length)

  const live = withView.filter((r) => ['live', 'expiring', 'scheduled'].includes(r.view))
  const pending = withView.filter((r) => r.view === 'pending')
  const oldest = pending.reduce<string | null>((m, r) => (!m || (r.submitted_at ?? '') < m ? r.submitted_at : m), null)
  const alerts = live.reduce((t, r) => t + r.buy_up, 0)
  const gps = live.map((r) => r.gp).filter((g): g is number => g != null)

  return (
    <div className="flex flex-col gap-4 px-1 pb-2">
      <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-[#E6E8EE] bg-white md:grid-cols-3 xl:grid-cols-6">
        <div className={tile}><span className={lbl}>Live rate cards</span><span className="text-[20px] text-[#067647]">{live.length}</span><span className={lbl}>{new Set(live.map((r) => r.account_id)).size} customers covered</span></div>
        <div className={tile}><span className={lbl}>Waiting approval</span><span className="text-[20px] text-[#B54708]">{pending.length}</span><span className={lbl}>{oldest ? `Oldest ${fmtDate(oldest)}` : 'None waiting'}</span></div>
        <div className={tile}><span className={lbl}>Drafts</span><span className="text-[20px]">{count('draft')}</span><span className={lbl}>Incl. changes asked</span></div>
        <div className={tile}><span className={lbl}>Expiring 30 days</span><span className="text-[20px]">{count('expiring')}</span><span className={lbl}>Renew before they lapse</span></div>
        <div className={tile}><span className={lbl}>Buy rate alerts</span><span className="text-[20px]" style={{ color: alerts ? '#B42318' : undefined }}>{alerts} lanes</span><span className={lbl}>Buy up since priced</span></div>
        <div className={tile}><span className={lbl}>Average GP, live</span><span className="text-[20px]">{gps.length ? `${(gps.reduce((a, b) => a + b, 0) / gps.length).toFixed(1)}%` : '–'}</span><span className={lbl}>Freight GP</span></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="customers-segment" role="group" aria-label="Status">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`customers-segment__btn${filter === f.key ? ' customers-segment__btn--on' : ''}`}>{f.label} {count(f.key)}</button>
          ))}
        </div>
        <span className="flex-1" />
        <select className="h-8 rounded-md border border-[#E6E8EE] bg-white px-2 text-[12.5px]" value={source} onChange={(e) => setSource(e.target.value as typeof source)} aria-label="Source">
          <option value="all">Customer rate cards and shared Setup cards</option><option value="rc">Customer rate cards only</option><option value="setup">Shared Setup cards only ({shared.length})</option>
        </select>
        {canAdd && <button type="button" className="btn quotes-page__new-btn" onClick={() => setNewOpen(true)}><Plus size={15} /> New rate card</button>}
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#C7D0E6] bg-[#F5F8FF] px-3 py-2 text-[12.5px]">
          <b className="font-medium">{picked.size} Setup card{picked.size > 1 ? 's' : ''} selected</b>
          <span className="text-[#5B6474]">{sharedRows.filter((c) => picked.has(c.id)).map((c) => c.customers.join(', ')).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}</span>
          <span className="flex-1" />
          {canAdd && <button type="button" className="btn quotes-page__new-btn" onClick={() => setConvert(sharedRows.filter((c) => picked.has(c.id)))}>Make one customer rate card</button>}
          <button type="button" className="text-[12px] text-[#5B6474]" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}

      <div className="customers-table card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Ref</th><th>Customer</th><th>Modes</th><th style={{ textAlign: 'right' }}>Lanes</th><th>Validity</th><th>Status</th>
              <th>Sales</th><th>Pricing</th><th style={{ textAlign: 'right' }}>GP</th><th>Watch</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="text-muted-foreground pad-inline">Loading…</td></tr>
                : shown.length + sharedShown.length === 0 ? <tr><td colSpan={10} className="text-muted-foreground pad-inline">No rate cards yet.</td></tr>
                : (source === 'setup' ? [] : shown).map((r) => (
                  <tr key={r.id} className="row-clickable" onClick={() => navigate(`/quotes/rate-cards/${r.id}`)}>
                    <td><span className="font-mono text-[12px]">{r.ref}</span>{r.version > 1 && <span className="ml-1 text-[11px] text-[#5B6474]">v{r.version}</span>}</td>
                    <td><div>{r.customer}</div>{r.title && <div className="text-[11.5px] text-[#5B6474]">{r.title}</div>}</td>
                    <td>{r.modes.map((m) => <span key={m} className="mr-1 inline-flex rounded bg-[#EEF1F8] px-1.5 text-[10.5px] text-[#0A2472]">{m}</span>)}</td>
                    <td style={{ textAlign: 'right' }}>{r.shown}{r.lanes > r.shown && <span className="text-[11px] text-[#5B6474]"> / {r.lanes}</span>}</td>
                    <td className="whitespace-nowrap">{fmtDate(r.valid_from)} to {fmtDate(r.valid_to)}</td>
                    <td><RateCardPill status={r.view} /></td>
                    <td>{staffMap.get(r.sales_id ?? '') ?? '–'}</td>
                    <td>{staffMap.get(r.pricing_id ?? '') ?? '–'}</td>
                    <td style={{ textAlign: 'right', color: r.min_gp != null && r.min_gp < 10 ? '#B42318' : undefined }}>{r.gp != null ? `${r.gp}%` : '–'}</td>
                    <td className="text-[12px]">{watchText(r)}</td>
                  </tr>
                ))}
              {!loading && sharedShown.map((c) => (
                <tr key={c.id} className="row-clickable" onClick={() => setPeek(c)} title="Open card">
                  <td onClick={(e) => e.stopPropagation()}>
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input type="checkbox" aria-label="Select card" checked={picked.has(c.id)}
                        onChange={() => setPicked((s) => { const x = new Set(s); if (x.has(c.id)) x.delete(c.id); else x.add(c.id); return x })} />
                      <span className="inline-flex rounded bg-[#F1F3F7] px-1.5 text-[10.5px] text-[#475467]">Setup card</span>
                    </label>
                  </td>
                  <td><div>{c.customers.slice(0, 2).join(', ')}{c.customers.length > 2 ? ` +${c.customers.length - 2}` : ''}</div><div className="text-[11.5px] text-[#5B6474]">{c.vendor ? `${c.vendor} · ` : ''}{c.title}</div></td>
                  <td><span className="mr-1 inline-flex rounded bg-[#EEF1F8] px-1.5 text-[10.5px] text-[#0A2472]">{String(c.rate_type).toUpperCase()}</span></td>
                  <td style={{ textAlign: 'right' }}>{c.lanes}</td>
                  <td className="whitespace-nowrap">{fmtDate(c.valid_from)} to {fmtDate(c.valid_to)}</td>
                  <td><RateCardPill status={c.view} /></td>
                  <td>–</td><td>–</td><td style={{ textAlign: 'right' }}>–</td>
                  <td className="text-[12px] text-[#5B6474]">Shared with {c.customers.length} customer{c.customers.length > 1 ? 's' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <NewRateCardDialog open={newOpen} onOpenChange={setNewOpen} />
      {peek && <SetupCardPeek card={peek} onClose={() => setPeek(null)} onConvert={(c) => { setPeek(null); setConvert([c]) }} />}
      {convert && <FromSetupDialog cards={convert} open onOpenChange={(o) => { if (!o) setConvert(null) }} />}
    </div>
  )
}

function watchText(r: CardListRow & { view: string }) {
  if (r.view === 'pending') return <span className="text-[#B54708]">Sent {fmtDate(r.submitted_at)}</span>
  if (r.buy_up) return <span className="text-[#B42318]">Buy up on {r.buy_up} lane{r.buy_up > 1 ? 's' : ''}</span>
  if (r.source_expiring) return <span className="text-[#C4320A]">{r.source_expiring} carrier rate{r.source_expiring > 1 ? 's' : ''} end early</span>
  if (r.view === 'expiring') return <span className="text-[#C4320A]">Expires {fmtDate(r.valid_to)}</span>
  if (r.view === 'live') return <span className="text-[#067647]">OK</span>
  return <span className="text-[#5B6474]">–</span>
}
