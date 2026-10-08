import { useMemo, useState } from 'react'
import { C, Seg } from '../reportsUi'
import { fetchSync } from './financeApi'
import { DATA_START, addMonths, fyEnd, fyLabel, fyOf, fyStart, lastClosedMonth, monthLabel, monthsBetween } from './financeUtil'
import { useAsync, Toggle } from './finUi'
import FinOverview from './FinOverview'
import FinPnl from './FinPnl'
import FinBalanceSheet from './FinBalanceSheet'
import FinCashFlow from './FinCashFlow'
import FinWorkingCapital from './FinWorkingCapital'
import FinForecast from './FinForecast'
import FinChecks from './FinChecks'
import FinCollections from './FinCollections'
import FinMatching from './FinMatching'
import FinLeaks from './FinLeaks'

export type View = 'overview' | 'pl' | 'bs' | 'cf' | 'wc' | 'collections' | 'matching' | 'leaks' | 'forecast' | 'checks'
const VIEWS: { k: View; label: string }[] = [
  { k: 'overview', label: 'CFO overview' }, { k: 'pl', label: 'Profit & loss' }, { k: 'bs', label: 'Balance sheet' },
  { k: 'cf', label: 'Cash flow' }, { k: 'wc', label: 'Debtors & creditors' }, { k: 'collections', label: 'Collections' },
  { k: 'matching', label: 'Match payments' }, { k: 'leaks', label: 'Margin leaks' }, { k: 'forecast', label: '13-week cash' },
  { k: 'checks', label: 'Checks' },
]

export type FinPeriod = {
  fy: number; toMonth: string; fromMonth: string; months: string[]
  lyMonths: string[]; hasLy: boolean; useAdj: boolean; label: string
}

export default function FinanceTab({ initialView }: { initialView?: View }) {
  const curMonth = new Date().toISOString().slice(0, 8) + '01'
  const firstFy = fyOf(DATA_START)
  const [view, setView] = useState<View>(initialView ?? 'overview')
  const [toMonth, setToMonth] = useState(lastClosedMonth())
  const [useAdj, setUseAdj] = useState(true)
  const fy = fyOf(toMonth)
  const sync = useAsync(fetchSync, [])

  const fys = useMemo(() => {
    const out: number[] = []
    for (let f = fyOf(curMonth); f >= firstFy; f--) out.push(f)
    return out
  }, [curMonth, firstFy])
  const monthOpts = monthsBetween(fyStart(fy), [fyEnd(fy).slice(0, 8) + '01', curMonth].sort()[0])

  const period: FinPeriod = useMemo(() => {
    const fromMonth = fyStart(fy)
    const months = monthsBetween(fromMonth, toMonth)
    const lyMonths = months.map((m) => addMonths(m, -12))
    return { fy, toMonth, fromMonth, months, lyMonths, hasLy: lyMonths[0] >= DATA_START, useAdj,
      label: `${fyLabel(fy)} YTD to ${monthLabel(toMonth)}` }
  }, [fy, toMonth, useAdj])

  const lastSync = sync.data?.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), '')
  const lastGl = sync.data?.[0]?.last_gl_date

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <Seg options={VIEWS} value={view} onChange={setView} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Seg options={fys.map((f) => ({ k: String(f), label: fyLabel(f) }))} value={String(fy)}
            onChange={(k) => {
              const f = Number(k)
              const end = [fyEnd(f).slice(0, 8) + '01', lastClosedMonth()].sort()[0]
              setToMonth(end < fyStart(f) ? fyStart(f) : end)
            }} />
          <select value={toMonth} onChange={(e) => setToMonth(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 10px', fontSize: 12.5, background: '#fff', color: C.ink }}>
            {monthOpts.map((m) => <option key={m} value={m}>to {monthLabel(m)}</option>)}
          </select>
          <Toggle on={useAdj} onChange={setUseAdj} label="Add back unposted job costs" />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: C.mut }}>
        {period.label}. Source: TradeWindow general ledger (company 01, NZD).
        {lastGl ? ` Ledger to ${lastGl}.` : ''}{lastSync ? ` Synced ${new Date(lastSync).toLocaleString('en-NZ')}.` : ''}
        {' '}Management accounts: no depreciation or income tax is posted in the ledger.
      </div>
      {view === 'overview' && <FinOverview p={period} />}
      {view === 'pl' && <FinPnl p={period} />}
      {view === 'bs' && <FinBalanceSheet p={period} />}
      {view === 'cf' && <FinCashFlow p={period} />}
      {view === 'wc' && <FinWorkingCapital p={period} />}
      {view === 'collections' && <FinCollections />}
      {view === 'matching' && <FinMatching />}
      {view === 'leaks' && <FinLeaks />}
      {view === 'forecast' && <FinForecast />}
      {view === 'checks' && <FinChecks />}
    </div>
  )
}
