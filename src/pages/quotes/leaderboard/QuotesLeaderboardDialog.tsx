import { useEffect, useState, type CSSProperties } from 'react'
import { Trophy, X, FileSpreadsheet, FileDown, Users, Building2, PieChart } from 'lucide-react'
import { toast } from 'sonner'
import type { QuotesMode, StatsPeriod } from '../quotesStatsApi'
import { fetchLeaderboard, fmtDay, fmtHrs, fmtPct, modeLabel, PERIOD_LABEL, type Leaderboard } from './leaderboardApi'
import { StaffTable, CustomerTable } from './LeaderboardTables'
import LeaderboardInsights from './LeaderboardInsights'
import { downloadLeaderboardCsv } from './leaderboardCsv'
import { downloadLeaderboardPdf } from './leaderboardPdfExport'

type Props = { open: boolean; onClose: () => void; mode: QuotesMode; initialPeriod: StatsPeriod }
type Tab = 'team' | 'customers' | 'insights'

const PERIODS: StatsPeriod[] = ['week', 'month', 'quarter', 'year']

export default function QuotesLeaderboardDialog({ open, onClose, mode, initialPeriod }: Props) {
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod)
  const [tab, setTab] = useState<Tab>('team')
  const [lb, setLb] = useState<Leaderboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => { if (open) setPeriod(initialPeriod) }, [open, initialPeriod])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetchLeaderboard(period, mode)
      .then((d) => { if (!cancelled) setLb(d) })
      .catch((e) => { if (!cancelled) { setLb(null); toast.error(e instanceof Error ? e.message : 'Load failed') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, period, mode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const pLabel = PERIOD_LABEL[period]
  const mText = modeLabel(mode)

  async function exportPdf() {
    if (!lb) return
    setPdfBusy(true)
    try { await downloadLeaderboardPdf(lb, pLabel, mText) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'PDF failed') }
    finally { setPdfBusy(false) }
  }

  const t = lb?.totals
  const kpis = [
    { l: 'Quotes', v: t ? String(t.quotes) : '–' },
    { l: 'Won', v: t ? String(t.won) : '–', c: '#047857' },
    { l: 'Lost', v: t ? String(t.lost) : '–', c: '#B91C1C' },
    { l: 'Win rate', v: fmtPct(t?.win_rate) },
    { l: 'Avg time to quote', v: fmtHrs(t?.avg_hrs_to_quote) },
    { l: 'Avg email to quote', v: fmtHrs(t?.avg_hrs_email_to_quote) },
    { l: 'Customers', v: t ? String(t.customers) : '–' },
  ]

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quotes leaderboard">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: '#FEF6E7', color: '#C9A227' }}>
              <Trophy size={17} strokeWidth={2} />
            </span>
            <div>
              <div className="text-base text-slate-900">Quotes leaderboard</div>
              <div className="text-xs text-slate-500">{mText}{lb ? ` · Since ${fmtDay(lb.since)}` : ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Period">
              {PERIODS.map((p) => (
                <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}
                  className={`rounded px-2.5 py-0.5 text-xs capitalize ${period === p ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
                  {p}
                </button>
              ))}
            </div>
            <button type="button" className="icon-btn" title="Export CSV" aria-label="Export CSV" disabled={!lb} onClick={() => lb && downloadLeaderboardCsv(lb, pLabel, mText)}>
              <FileSpreadsheet size={17} strokeWidth={2} />
            </button>
            <button type="button" className="icon-btn" title="Export PDF" aria-label="Export PDF" disabled={!lb || pdfBusy} onClick={exportPdf}>
              <FileDown size={17} strokeWidth={2} />
            </button>
            <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={onClose}>
              <X size={17} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pt-4 sm:grid-cols-4 lg:grid-cols-7">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-lg leading-6" style={{ color: k.c ?? '#0A2472' }}>{loading && !lb ? '–' : k.v}</div>
              <div className="truncate text-[11px] text-slate-500">{k.l}</div>
            </div>
          ))}
        </div>

        <div className="quotes-tabs mx-5 mt-3" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'team'} onClick={() => setTab('team')}
            className={`quotes-tabs__btn${tab === 'team' ? ' quotes-tabs__btn--on' : ''}`}>
            <Users size={14} strokeWidth={2} /> Team
          </button>
          <button type="button" role="tab" aria-selected={tab === 'customers'} onClick={() => setTab('customers')}
            className={`quotes-tabs__btn${tab === 'customers' ? ' quotes-tabs__btn--on' : ''}`}>
            <Building2 size={14} strokeWidth={2} /> Customers
          </button>
          <button type="button" role="tab" aria-selected={tab === 'insights'} onClick={() => setTab('insights')}
            className={`quotes-tabs__btn${tab === 'insights' ? ' quotes-tabs__btn--on' : ''}`}>
            <PieChart size={14} strokeWidth={2} /> Insights
          </button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-auto px-5 pb-4" style={{ opacity: loading ? 0.55 : 1 }}>
          {!lb ? (
            <p className="py-10 text-center text-sm text-slate-500">{loading ? 'Loading…' : 'No data.'}</p>
          ) : tab === 'team' ? <StaffTable rows={lb.staff} /> : tab === 'customers' ? <CustomerTable rows={lb.customers} /> : <LeaderboardInsights lb={lb} />}
        </div>

        <div className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-500">
          Time to quote: quote created to first rate response. Email to quote: customer email to first rate response (matched by account or contact, within 3 days). Per day uses working days.
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const sheet: CSSProperties = {
  background: '#fff', borderRadius: 12, width: 'min(1180px, calc(96vw / var(--mz, 1)))', maxHeight: 'calc(88vh / var(--mz, 1))',
  display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(15,23,42,0.25)', overflow: 'hidden',
}
