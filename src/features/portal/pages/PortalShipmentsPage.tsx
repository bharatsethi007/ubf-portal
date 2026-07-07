import { useMemo } from 'react'
import { usePorts } from '../../../hooks/usePorts'
import RangeTabs from '../components/RangeTabs'
import ShipmentsTable from '../components/ShipmentsTable/ShipmentsTable'
import { buildContainerNumberMap } from '../dashboard/portalContainerLabels'
import { usePortalDashboard } from '../dashboard/usePortalDashboard'
import { usePortalRange } from '../dashboard/usePortalRange'

/** Full-page My Shipments — same table/filters as dashboard, dedicated nav route. */
export default function PortalShipmentsPage() {
  const [range, setRange] = usePortalRange()
  const { ports } = usePorts()
  const { data, loading, error } = usePortalDashboard(range)

  const containerMap = useMemo(
    () => buildContainerNumberMap(data.containers),
    [data.containers],
  )

  return (
    <>
      <div className="portal-title-row">
        <div>
          <h1 className="portal-title">Shipments</h1>
          <div className="portal-subtitle">Track all your bookings and stay updated</div>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {error && (
        <div className="portal-card portal-card--pad" style={{ marginBottom: 16, color: 'var(--portal-orange)' }}>
          {error}
        </div>
      )}

      {loading && !data.shipments.length ? (
        <p className="portal-empty">Loading shipments…</p>
      ) : (
        <ShipmentsTable rows={data.shipments} ports={ports} containerMap={containerMap} />
      )}
    </>
  )
}
