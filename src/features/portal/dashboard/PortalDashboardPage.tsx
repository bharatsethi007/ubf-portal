import { useMemo, useState } from 'react'
import { usePorts } from '../../../hooks/usePorts'
import AttentionList from '../components/AttentionList'
import FlatWorldMap from '../components/FlatWorldMap/FlatWorldMap'
import ImportExportKpi from '../components/ImportExportKpi'
import KpiOverview from '../components/KpiOverview'
import { PendingPaymentsKpi } from '../components/KpiStat'
import RangeTabs from '../components/RangeTabs'
import ScheduleCalendar from '../components/ScheduleCalendar'
import ShipmentsTable from '../components/ShipmentsTable/ShipmentsTable'
import { buildCalendar } from './portalDashboardApi'
import { buildContainerNumberMap } from './portalContainerLabels'
import { usePortalDashboard } from './usePortalDashboard'
import { usePortalRange } from './usePortalRange'

export default function PortalDashboardPage() {
  const [range, setRange] = usePortalRange()
  const [calOffset, setCalOffset] = useState(0)
  const { ports } = usePorts()
  const { data, loading, error, refresh } = usePortalDashboard(range)

  const calAnchor = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(12, 0, 0, 0)
    d.setMonth(d.getMonth() + calOffset)
    return d
  }, [calOffset])

  const calendar = useMemo(
    () => buildCalendar(data.shipments, calAnchor),
    [data.shipments, calAnchor],
  )

  const containerMap = useMemo(
    () => buildContainerNumberMap(data.containers),
    [data.containers],
  )

  const rowsByJob = useMemo(
    () => new Map(data.shipments.map((r) => [r.job_unique, r])),
    [data.shipments],
  )

  const inTransit = data.kpis.find((k) => k.label === 'In Transit')?.value ?? data.openCount

  return (
    <>
      <div className="portal-title-row">
        <div>
          <h1 className="portal-title">Dashboard overview</h1>
          <div className="portal-subtitle">
            Last updated: {data.lastUpdatedLabel || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <RangeTabs value={range} onChange={setRange} />
          <button type="button" className="portal-btn-primary" onClick={() => refresh()}>
            + Create New <span style={{ opacity: 0.5 }}>|</span> ▾
          </button>
        </div>
      </div>

      {error && (
        <div className="portal-card portal-card--pad" style={{ marginBottom: 16, color: 'var(--portal-orange)' }}>
          {error}
        </div>
      )}

      {loading && !data.shipments.length ? (
        <p className="portal-empty">Loading dashboard…</p>
      ) : (
        <div className="portal-dashboard__body">
          <div className="portal-dashboard__main">
            <div className="portal-grid portal-grid--kpi-top">
              <KpiOverview metrics={data.kpis} />
              <PendingPaymentsKpi {...data.payments} />
            </div>

            <ImportExportKpi trade={data.trade} />

            <ShipmentsTable rows={data.shipments} ports={ports} containerMap={containerMap} />

            <ScheduleCalendar
              monthLabel={calendar.monthLabel}
              days={calendar.days}
              rowsByJob={rowsByJob}
              containerMap={containerMap}
              ports={ports}
              onPrevMonth={() => setCalOffset((o) => o - 1)}
              onNextMonth={() => setCalOffset((o) => o + 1)}
            />
          </div>

          <aside className="portal-dashboard__aside">
            <FlatWorldMap lanes={data.globe.lanes} ports={ports} inTransit={inTransit} />
            <AttentionList items={data.attention} />
          </aside>
        </div>
      )}
    </>
  )
}
