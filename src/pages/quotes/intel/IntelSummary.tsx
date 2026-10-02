import { CountUp, MarginDial, RangeBar } from './IntelMotion'
import type { IntelOption, LaneIntel } from './laneIntelApi'
import { nzd, pct1 } from './useLaneIntel'

export function IntelKpis({ intel }: { intel: LaneIntel }) {
  const t = intel.totals
  return (
    <div className="fi-sec">
      <div className="fi-kpis">
        <div className="fi-kpi"><div className="fi-kpi__v"><CountUp value={intel.jobs} format={(n) => Math.round(n).toLocaleString()} /></div><div className="fi-kpi__l">jobs, last {intel.months} mo</div></div>
        <div className="fi-kpi"><div className="fi-kpi__v">{t ? <CountUp value={t.medSell} format={nzd} /> : '-'}</div><div className="fi-kpi__l">median job sell</div></div>
        <div className="fi-kpi"><div className="fi-kpi__v">{t?.gpPct != null ? <CountUp value={t.gpPct} format={pct1} /> : '-'}</div><div className="fi-kpi__l">lane GP</div></div>
      </div>
      {intel.jobs > 0 && intel.jobs < 5 && <div className="fi-note">Thin sample. Treat these numbers as a rough guide.</div>}
    </div>
  )
}

export function IntelMargin({ intel, option }: { intel: LaneIntel; option: IntelOption }) {
  const t = intel.totals
  if (!t || t.gpPct == null || option.marginPct == null || !option.totalSell) return null
  const lo = t.gpP25 ?? t.gpPct - 8, hi = t.gpP75 ?? t.gpPct + 8
  const m = option.marginPct
  const v = m < lo ? { tone: '#D97706', txt: 'Below lane norm', sub: `Usual GP here is ${pct1(lo)} to ${pct1(hi)}. Check buy rates or missing charges.` }
    : m > hi ? { tone: '#2563eb', txt: 'Above lane norm', sub: `Usual GP is ${pct1(lo)} to ${pct1(hi)}. Fine if the market holds, watch competitiveness.` }
      : { tone: '#1F8A4C', txt: 'In normal range', sub: `Lane GP band ${pct1(lo)} to ${pct1(hi)}.` }
  const nzdQuote = option.currency === 'NZD'
  const min = Math.min(t.p25Sell * 0.6, option.totalSell), max = Math.max(t.p75Sell * 1.4, option.totalSell)
  return (
    <div className="fi-sec" style={{ animationDelay: '.06s' }}>
      <div className="fi-label">Margin check<span className="fi-label__aside">{option.responseNo ?? 'current option'}</span></div>
      <div className="fi-margin">
        <MarginDial value={m} lo={lo} hi={hi} tone={v.tone} />
        <div>
          <div className="fi-verdict" style={{ color: v.tone }}><CountUp value={m} format={pct1} /> GP · {v.txt}</div>
          <div className="fi-verdict__sub">{v.sub}</div>
        </div>
      </div>
      {nzdQuote ? (
        <>
          <div className="fi-muted" style={{ marginTop: 10 }}>Quote total {nzd(option.totalSell)} vs past job sell</div>
          <RangeBar min={min} p25={t.p25Sell} med={t.medSell} p75={t.p75Sell} max={max} mark={option.totalSell} fmt={nzd} />
        </>
      ) : <div className="fi-muted" style={{ marginTop: 8 }}>Option is in {option.currency}. Sell comparison shown in NZD only.</div>}
    </div>
  )
}
