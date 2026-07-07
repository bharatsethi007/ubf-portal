import type { ReactNode } from 'react'
import { Plane, Ship } from 'lucide-react'
import type { TradeKpiMetrics, TradeModeMetrics } from '../dashboard/portalTradeKpi'
import { formatCbm, formatKg } from '../dashboard/portalFormat'

type Props = { trade: TradeKpiMetrics }

function ModeBlock({
  icon: Icon,
  label,
  count,
  detail,
}: {
  icon: typeof Plane
  label: string
  count: number
  detail: ReactNode
}) {
  return (
    <div className="portal-trade-row">
      <div className="portal-trade-row__head">
        <Icon size={14} className="portal-trade-row__icon" aria-hidden />
        <span className="portal-trade-row__mode">{label}</span>
        <span className="portal-trade-row__count nums">{count}</span>
      </div>
      <div className="portal-trade-row__detail">{detail}</div>
    </div>
  )
}

function TradeCard({ title, metrics, seaSplitAvailable }: {
  title: string
  metrics: TradeModeMetrics
  seaSplitAvailable: boolean
}) {
  const fclSizes = [
    metrics.seaFcl.containers20 > 0 ? `20′ × ${metrics.seaFcl.containers20}` : null,
    metrics.seaFcl.containers40 > 0 ? `40′ × ${metrics.seaFcl.containers40}` : null,
    metrics.seaFcl.containers40Hc > 0 ? `40′HC × ${metrics.seaFcl.containers40Hc}` : null,
  ].filter(Boolean)

  return (
    <div className="portal-card portal-card--pad">
      <div className="portal-card-title">{title}</div>
      <div className="portal-trade-stack">
        <ModeBlock
          icon={Plane}
          label="Air"
          count={metrics.air.count}
          detail={<span className="nums">Total weight {formatKg(metrics.air.totalWeightKg)}</span>}
        />
        {seaSplitAvailable ? (
          <>
            <ModeBlock
              icon={Ship}
              label="Sea · LCL"
              count={metrics.seaLcl.count}
              detail={<span className="nums">{formatCbm(metrics.seaLcl.totalCbm)}</span>}
            />
            <ModeBlock
              icon={Ship}
              label="Sea · FCL"
              count={metrics.seaFcl.jobCount}
              detail={
                fclSizes.length ? (
                  <span className="nums">{fclSizes.join(' · ')}</span>
                ) : (
                  <span className="portal-trade-muted">Container sizes pending sync</span>
                )
              }
            />
          </>
        ) : (
          <ModeBlock
            icon={Ship}
            label="Sea"
            count={metrics.sea.count}
            detail={<span className="nums">{formatCbm(metrics.sea.totalCbm)}</span>}
          />
        )}
      </div>
    </div>
  )
}

export default function ImportExportKpi({ trade }: Props) {
  return (
    <div className="portal-grid portal-grid--trade">
      <TradeCard title="Imports" metrics={trade.imports} seaSplitAvailable={trade.seaSplitAvailable} />
      <TradeCard title="Exports" metrics={trade.exports} seaSplitAvailable={trade.seaSplitAvailable} />
    </div>
  )
}
