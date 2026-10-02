import type { LaneIntel } from './laneIntelApi'
import { nzd, pct1 } from './useLaneIntel'

const gpTone = (g: number | null) => (g == null ? { background: '#f1f4f9', color: '#64708a' }
  : g < 15 ? { background: '#fdecec', color: '#B23B3B' } : g < 30 ? { background: '#fff4e0', color: '#8a5a10' } : { background: '#e8f6ee', color: '#1F6B3E' })
const size = (w: number | null, v: number | null) => [w ? `${Math.round(w).toLocaleString()} kg` : null, v ? `${v.toFixed(1)} m³` : null].filter(Boolean).join(' · ')
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

export default function IntelHistory({ intel, customerName }: { intel: LaneIntel; customerName: string | null }) {
  const c = intel.customer
  return (
    <>
      {c && (
        <div className="fi-sec" style={{ animationDelay: '.18s' }}>
          <div className="fi-label">{customerName || 'This customer'} on this lane</div>
          <div className="fi-kpis">
            <div className="fi-kpi"><div className="fi-kpi__v">{c.jobs}</div><div className="fi-kpi__l">jobs, last {d(c.lastDate)}</div></div>
            <div className="fi-kpi"><div className="fi-kpi__v">{c.medSell != null ? nzd(c.medSell) : '-'}</div><div className="fi-kpi__l">median sell</div></div>
            <div className="fi-kpi"><div className="fi-kpi__v">{c.gpPct != null ? pct1(c.gpPct) : '-'}</div><div className="fi-kpi__l">their GP</div></div>
          </div>
        </div>
      )}
      {intel.similar.length > 0 && (
        <div className="fi-sec" style={{ animationDelay: '.24s' }}>
          <div className="fi-label">Similar past jobs<span className="fi-label__aside">sell · GP</span></div>
          {intel.similar.map((j, i) => (
            <div key={`${j.jobNo}-${i}`} className="fi-job" style={{ animationDelay: `${0.26 + i * 0.05}s` }}>
              <div className="fi-job__main">
                <div className="fi-job__cust">{j.customer || '-'}{j.sameCustomer && <span className="fi-row__tag">same customer</span>}</div>
                <div className="fi-muted">{[j.jobNo, d(j.date), size(j.weightKg, j.volumeM3)].filter(Boolean).join(' · ')}</div>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums', alignSelf: 'center' }}>{nzd(j.sell)}</span>
              <span className="fi-chip" style={{ ...gpTone(j.gpPct), alignSelf: 'center' }}>{j.gpPct != null ? pct1(j.gpPct) : '-'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
