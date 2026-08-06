import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchTradeLanes, type TradeLane } from './reportsApi'

const SEGMENTS: { label: string; dir: string | null; mode: string | null }[] = [
  { label: 'All', dir: null, mode: null },
  { label: 'Import Sea', dir: 'import', mode: 'sea' },
  { label: 'Import Air', dir: 'import', mode: 'air' },
  { label: 'Export Sea', dir: 'export', mode: 'sea' },
  { label: 'Export Air', dir: 'export', mode: 'air' },
]

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function monthsAgo(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return d }

export default function VolumesLanesTab() {
  const [seg, setSeg] = useState(0)
  const [months, setMonths] = useState(12)
  const [rows, setRows] = useState<TradeLane[]>([])
  const [loading, setLoading] = useState(false)

  const range = useMemo(() => ({ from: ymd(monthsAgo(months)), to: ymd(new Date()) }), [months])

  useEffect(() => {
    setLoading(true)
    const s = SEGMENTS[seg]
    fetchTradeLanes(range.from, range.to, s.dir, s.mode, 50)
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [seg, range])

  const totals = rows.reduce((a, r) => ({
    jobs: a.jobs + Number(r.jobs), teu: a.teu + Number(r.teu),
    cbm: a.cbm + Number(r.cbm), weight: a.weight + Number(r.weight_kg),
  }), { jobs: 0, teu: 0, cbm: 0, weight: 0 })

  const showTeu = SEGMENTS[seg].mode !== 'air'
  const showWeight = SEGMENTS[seg].mode !== 'sea'

  return (
    <div className="card quotes-page__card">
      <div className="quotes-page__toolbar" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="quotes-tabs">
          {SEGMENTS.map((s, i) => (
            <button key={s.label} className={`quotes-tabs__btn${seg === i ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setSeg(i)}>{s.label}</button>
          ))}
        </div>
        <select className="input input--sm" value={months} onChange={(e) => setMonths(Number(e.target.value))} style={{ marginLeft: 'auto' }}>
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '4px 12px 12px', flexWrap: 'wrap' }}>
        <Stat label="Jobs" value={totals.jobs.toLocaleString()} />
        {showTeu ? <Stat label="TEU" value={Math.round(totals.teu).toLocaleString()} /> : null}
        <Stat label="CBM" value={Math.round(totals.cbm).toLocaleString()} />
        {showWeight ? <Stat label="Weight (kg)" value={Math.round(totals.weight).toLocaleString()} /> : null}
        <Stat label="Lanes" value={rows.length.toString()} />
      </div>

      {loading ? (
        <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Loader2 className="spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground pad-inline">No shipments in this window.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lane</th><th>Segment</th>
                <th style={{ textAlign: 'right' }}>Jobs</th>
                {showTeu ? <th style={{ textAlign: 'right' }}>TEU</th> : null}
                <th style={{ textAlign: 'right' }}>CBM</th>
                {showWeight ? <th style={{ textAlign: 'right' }}>Weight (kg)</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.origin} → {r.destination}</td>
                  <td className="text-muted-foreground">{r.direction} {r.mode}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right' }}>{Number(r.jobs).toLocaleString()}</td>
                  {showTeu ? <td className="tabular-nums" style={{ textAlign: 'right' }}>{Math.round(Number(r.teu)).toLocaleString()}</td> : null}
                  <td className="tabular-nums" style={{ textAlign: 'right' }}>{Math.round(Number(r.cbm)).toLocaleString()}</td>
                  {showWeight ? <td className="tabular-nums" style={{ textAlign: 'right' }}>{Math.round(Number(r.weight_kg)).toLocaleString()}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted-foreground)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0A2472' }}>{value}</div>
    </div>
  )
}
