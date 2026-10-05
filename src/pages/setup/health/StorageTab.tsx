import { useState } from 'react'
import { toast } from 'sonner'
import { HardDrive, RotateCw } from 'lucide-react'
import { CountUp, Empty, Skeleton, Widget } from '../../tower/towerUi'
import { runProbe, type Storage, useHealthRpc } from './healthApi'
import { ago, Dot, fmtBytes, ms, nzTime, ShareRow } from './healthUi'

function TrendChart({ points }: { points: { day: string; bytes: number }[] }) {
  if (points.length < 2) return <Empty title="Trend builds nightly">One point per day from the nightly snapshot.</Empty>
  const W = 600, H = 180, pad = 8
  const max = Math.max(...points.map((p) => p.bytes)) * 1.1 || 1
  const xy = points.map((p, i) => [pad + (i / (points.length - 1)) * (W - pad * 2), H - pad - (p.bytes / max) * (H - pad * 2)])
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg className="sh-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="S3 size trend">
      <defs>
        <linearGradient id="sh-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1A3A" stopOpacity=".18" /><stop offset="1" stopColor="#0B1A3A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="area" d={`${line} L${xy[xy.length - 1][0]} ${H} L${xy[0][0]} ${H}Z`} />
      <path className="line" d={line} />
    </svg>
  )
}

export default function StorageTab() {
  const { data, loading, error } = useHealthRpc<Storage>('system_storage')
  const [busy, setBusy] = useState(false)

  const snapshot = async () => {
    setBusy(true)
    try {
      const r = await runProbe('storage')
      if (!r.ok) throw new Error(r.error ?? 'failed')
      toast.success(`Snapshot taken · ${r.areas} areas`)
    } catch (e) {
      toast.error(`Snapshot failed: ${e instanceof Error ? e.message : e}`)
    } finally { setBusy(false) }
  }

  if (error) return <Empty title="Could not load storage">{error}</Empty>
  if (loading && !data) return <div style={{ display: 'grid', gap: 12 }}><Skeleton h={110} /><Skeleton h={260} /></div>
  const s = data!
  const total = s.areas.reduce((a, x) => a + x.bytes, 0)
  const objects = s.areas.reduce((a, x) => a + x.objects, 0)
  const lastCheck = s.checks[0]
  const maxArea = Math.max(1, ...s.areas.map((a) => a.bytes))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tw-kpis">
        <div className="tw-card tw-kpi">
          <div className="tw-kpi__l">S3 total</div>
          <CountUp className="tw-kpi__v" value={total} format={fmtBytes} />
          <div className="tw-kpi__s">ubf-portal-files-akl · Auckland</div>
        </div>
        <div className="tw-card tw-kpi" style={{ animationDelay: '50ms' }}>
          <div className="tw-kpi__l">Objects</div>
          <CountUp className="tw-kpi__v" value={objects} />
          <div className="tw-kpi__s">Snapshot {ago(s.latest_at)}</div>
        </div>
        <div className="tw-card tw-kpi" style={{ animationDelay: '100ms' }}>
          <div className="tw-kpi__l">Read / write test</div>
          <div className="tw-kpi__v" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Dot tone={lastCheck ? (lastCheck.ok ? 'ok' : 'bad') : 'idle'} pulse={!!lastCheck?.ok} />
            {lastCheck ? (lastCheck.ok ? 'Passing' : 'Failing') : 'Pending'}
          </div>
          <div className="tw-kpi__s">{lastCheck ? `${ms(lastCheck.ms)} round trip · ${ago(lastCheck.at)}` : 'Runs every 15 min'}</div>
        </div>
      </div>

      <div className="tw-grid">
        <Widget title="Size over time" style={{ gridColumn: 'span 7' }}>
          <div className="tw-wb"><TrendChart points={s.trend} /></div>
        </Widget>
        <Widget title="By area" count={s.areas.length} style={{ gridColumn: 'span 5' }}>
          <div className="tw-wb">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 4 }}>
              <button type="button" className="tw-ib tw-ib--sm" title="Take snapshot now" aria-label="Take snapshot now" onClick={snapshot} disabled={busy}>
                <RotateCw size={14} className={busy ? 'sh-spin' : ''} />
              </button>
            </div>
            {s.areas.length ? s.areas.map((a, i) => (
              <ShareRow key={a.area} label={a.area} value={a.bytes} max={maxArea} delay={i * 40}
                right={<>{fmtBytes(a.bytes)} <span style={{ color: 'var(--faint)' }}>· {a.objects.toLocaleString()}</span></>} />
            )) : <Empty title="No snapshot yet" icon={<HardDrive size={20} />}>Use the refresh icon to take one now.</Empty>}
          </div>
        </Widget>
      </div>

      {!!s.checks.length && (
        <Widget title="S3 checks" count={s.checks.length}>
          <div className="tw-tw">
            <table className="tw-t">
              <thead><tr><th>Time</th><th className="r">Round trip</th><th>Result</th></tr></thead>
              <tbody>
                {s.checks.map((c, i) => (
                  <tr key={i} style={{ cursor: 'default' }}>
                    <td className="m">{nzTime(c.at)}</td>
                    <td className="r tw-num">{ms(c.ms)}</td>
                    <td>{c.ok ? <span className="tw-pill tw-pill--green">Pass</span> : <span className="tw-pill tw-pill--red" title={c.error ?? ''}>Fail</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Widget>
      )}
    </div>
  )
}
