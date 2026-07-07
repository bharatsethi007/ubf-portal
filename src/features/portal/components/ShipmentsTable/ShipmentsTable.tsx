import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PortMap } from '../../../hooks/usePorts'
import { formatShortDate } from '../../dashboard/portalFormat'
import { shipmentDetailPath, shipmentTrackingId, type PortalShipmentRow } from '../../dashboard/portalDashboardApi'
import { formatContainerNumbers } from '../../dashboard/portalContainerLabels'
import { resolvePortCountryCode, resolvePortLabel } from '../../dashboard/portalPortDisplay'
import { counterpartyName, customerRefDisplay, partyColumnHeader, type DirectionTab } from '../../dashboard/portalShipmentParty'
import {
  DIRECTION_TABS,
  filterShipments,
  MODE_TABS,
  PAGE_SIZE,
  paginateRows,
  pageCount,
  type ModeTab,
} from '../../dashboard/portalShipmentTableFilters'
import { arrivalDate, departureDate } from '../../dashboard/portalShipmentDates'
import CarrierChip from './CarrierChip'
import ShipmentNumericCluster from './ShipmentNumericCluster'
import ShipmentsTablePagination from './ShipmentsTablePagination'
import StatusPill from './StatusPill'

type Props = {
  rows: PortalShipmentRow[]
  ports: PortMap
  containerMap: Map<string, string[]>
}

function portCell(
  code: string | null,
  mode: string | null,
  ports: PortMap,
  date: string | null,
) {
  const cc = resolvePortCountryCode(code, mode, ports)
  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--portal-ink2)' }}>
        <span className={`fi fi-${cc}`} style={{ marginRight: 6 }} />
        {resolvePortLabel(code, mode, ports)}
      </div>
      <div className="nums" style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 3 }}>
        {formatShortDate(date)}
      </div>
    </>
  )
}

function modeCell(row: PortalShipmentRow, containerMap: Map<string, string[]>) {
  const containers = row.mode === 'sea' && row.consol_key
    ? formatContainerNumbers(containerMap.get(row.consol_key))
    : ''

  return (
    <div className="portal-mode-cell">
      <CarrierChip carrier={row.vessel_flight ?? 'Carrier TBC'} mode={row.mode} />
      {containers && (
        <div className="portal-mode-cell__container nums">{containers}</div>
      )}
    </div>
  )
}

export default function ShipmentsTable({ rows, ports, containerMap }: Props) {
  const [dirTab, setDirTab] = useState<DirectionTab>('all')
  const [modeTab, setModeTab] = useState<ModeTab>('All')
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [dirTab, modeTab])

  const filtered = useMemo(
    () => filterShipments(rows, dirTab, modeTab),
    [rows, dirTab, modeTab],
  )

  const totalPages = pageCount(filtered.length, PAGE_SIZE)
  const pageRows = paginateRows(filtered, Math.min(page, totalPages), PAGE_SIZE)
  const partyHeader = partyColumnHeader(dirTab)

  return (
    <div className="portal-card portal-card--pad">
      <div className="portal-card-title">My Shipments</div>
      <div style={{ color: 'var(--portal-muted)', fontSize: 12.5, marginTop: 4 }}>
        Track all your bookings and stay updated
      </div>

      <div className="portal-ship-filters">
        <div className="portal-ship-filters__row">
          {DIRECTION_TABS.map(({ key, label }) => (
            <button key={key} type="button"
              className={`portal-filter-btn${dirTab === key ? ' portal-filter-btn--on-dark' : ''}`}
              onClick={() => setDirTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="portal-ship-filters__row">
          {MODE_TABS.map((t) => (
            <button key={t} type="button"
              className={`portal-filter-btn${modeTab === t ? ' portal-filter-btn--on' : ''}`}
              onClick={() => setModeTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="portal-empty">No shipments in this view.</p>
      ) : (
        <>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  {['Job no.', partyHeader, 'Reference', 'From', 'To', 'Mode', 'Pcs / Wt / CBM', 'Status'].map((h) => (
                    <th key={h} className={h === 'Pcs / Wt / CBM' ? 'portal-th--nums' : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <tr key={s.job_unique}>
                    <td>
                      <Link to={shipmentDetailPath(s)} className="portal-job-link nums">
                        {shipmentTrackingId(s)}
                      </Link>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--portal-ink2)', maxWidth: 140 }}>
                      {counterpartyName(s) ?? '—'}
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--portal-ink2)', maxWidth: 120 }}>
                      {customerRefDisplay(s)}
                    </td>
                  <td>{portCell(s.origin, s.mode, ports, departureDate(s))}</td>
                  <td>{portCell(s.destination, s.mode, ports, arrivalDate(s))}</td>
                    <td>{modeCell(s, containerMap)}</td>
                    <td className="portal-td--nums"><ShipmentNumericCluster row={s} /></td>
                    <td><StatusPill status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ShipmentsTablePagination
            page={Math.min(page, totalPages)}
            totalPages={totalPages}
            totalRows={filtered.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}
