import type { KpiMetric } from '../dashboard/portalDashboardApi'
import Sparkline from './Sparkline'

type Props = { metrics: KpiMetric[] }

export default function KpiOverview({ metrics }: Props) {
  return (
    <div className="portal-card portal-card--pad">
      <div className="portal-card-title">Shipment overview</div>
      <div className="portal-kpi-row">
        {metrics.map((m, i) => (
          <div key={m.label} className="portal-kpi-col">
            <div className="portal-kpi-label">{m.label}</div>
            <div className="portal-kpi-spark"><Sparkline up={m.up} id={`kpi-${i}`} /></div>
            <div className="portal-kpi-value-row">
              <span className="portal-kpi-value nums">{m.value}</span>
              <span className={`portal-kpi-delta nums${m.up ? ' portal-kpi-delta--up' : ''}`}>
                {m.up ? '↑' : '↓'} {m.deltaPct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
