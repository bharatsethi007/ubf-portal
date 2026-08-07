import { Archive } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { SkeletonBusy } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import BoardRowCheckbox, {
  BoardCheckboxCell,
  BoardHeaderCheckbox,
} from '@/components/board/BoardRowCheckbox'
import type { BoardHeaderCheckState } from '@/components/board/useBoardRowSelection'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ImportSeaBoardTableSkeleton from './ImportSeaBoardTableSkeleton'
import BoardDateCell from './cells/BoardDateCell'
import BoardSourcedDateCell from './cells/BoardSourcedDateCell'
import BookingRefCell from './cells/BookingRefCell'
import ClientCell from './cells/ClientCell'
import ContainerCell from './cells/ContainerCell'
import HoldCell from './cells/HoldCell'
import ImportSeaRowRefreshCell from './ImportSeaRowRefreshCell'
import { bookingRecordHref } from './importSeaFilterUrl'
import ImportSeaOpsStatus from './ImportSeaOpsStatus'
import type { ImportSeaBoardCellKey } from './importSeaRowDiff'
import type { ImportSeaRow } from './types'

const COL_SPAN = 16

type SortableThProps = {
  label: string
  columnKey: keyof ImportSeaRow
  sortKey: keyof ImportSeaRow | null
  sortDir: 'asc' | 'desc'
  onSort: (key: keyof ImportSeaRow) => void
  className?: string
}

function SortableTh({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className,
}: SortableThProps) {
  const active = sortKey === columnKey
  const indicator = active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'

  function activate() {
    onSort(columnKey)
  }

  return (
    <th
      role="button"
      tabIndex={0}
      className={`sortable-th${className ? ` ${className}` : ''}`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
    >
      {label}
      <span className={`sortable-th__ind${active ? ' sortable-th__ind--active' : ' muted'}`}>
        {indicator}
      </span>
    </th>
  )
}

type Props = {
  rows: ImportSeaRow[]
  loading: boolean
  sortKey: keyof ImportSeaRow | null
  sortDir: 'asc' | 'desc'
  onSort: (key: keyof ImportSeaRow) => void
  selectedIds: Set<string>
  headerCheckState: BoardHeaderCheckState
  onToggleRow: (id: string, index: number, shiftKey: boolean) => void
  onToggleAllVisible: (checked: boolean) => void
  onRefreshRow: (row: ImportSeaRow) => void
  isRowRefreshing: (id: string) => boolean
  rowRefreshCooldownSec: (id: string) => number
  isCellFlashing: (rowId: string, key: ImportSeaBoardCellKey) => boolean
  onToggleInvoice: (id: string, key: 'inv_approved' | 'inv_sent', value: boolean) => void
}

function flashClass(active: boolean): string {
  return active ? ' import-sea-board-cell--flash' : ''
}

export default function ImportSeaBoardTable({
  rows,
  loading,
  sortKey,
  sortDir,
  onSort,
  selectedIds,
  headerCheckState,
  onToggleRow,
  onToggleAllVisible,
  onRefreshRow,
  isRowRefreshing,
  rowRefreshCooldownSec,
  isCellFlashing,
  onToggleInvoice,
}: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  function openRecord(id: string) {
    navigate(bookingRecordHref(id, searchParams))
  }

  return (
    <TooltipProvider delay={300}>
      <div className="shipments-table card import-sea-board">
        <SkeletonBusy busy={loading} className="table-wrap">
          <table className="data-table import-sea-board__table">
            <thead>
              <tr>
                <th className="board-checkbox-col">
                  <BoardHeaderCheckbox
                    state={headerCheckState}
                    disabled={loading || rows.length === 0}
                    onChange={onToggleAllVisible}
                  />
                </th>
                <SortableTh label="Booking ref" columnKey="booking_ref" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="import-sea-col-bref" />
                <SortableTh label="Job #" columnKey="job_no" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="import-sea-col-job" />
                <SortableTh label="Client" columnKey="customer_name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="import-sea-col-client" />
                <SortableTh label="ETA" columnKey="eta" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Container</th>
                <SortableTh label="ATF" columnKey="atf" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Devanner</th>
                <SortableTh label="LFD" columnKey="last_free_day" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Delivery" columnKey="delivery_date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Return" columnKey="container_return_date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Hold" columnKey="hold_code" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Status</th>
                <th className="import-sea-col-inv">Inv appr</th>
                <th className="import-sea-col-inv">Inv sent</th>
                <th className="import-sea-col-refresh" aria-label="Refresh" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <ImportSeaBoardTableSkeleton colSpan={COL_SPAN} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COL_SPAN} className="muted pad-inline">
                    No bookings match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const onHold = Boolean(row.hold_code)
                  const selected = selectedIds.has(row.id)

                  return (
                    <tr
                      key={row.id}
                      className={`row-clickable${onHold ? ' import-sea-row--hold' : ''}${selected ? ' board-row--selected' : ''}${row.archived_at ? ' opacity-60 italic' : ''}`}
                      onClick={() => openRecord(row.id)}
                    >
                      <BoardCheckboxCell>
                        <BoardRowCheckbox
                          checked={selected}
                          ariaLabel={`Select ${row.booking_ref ?? 'booking'}`}
                          onToggle={(shiftKey) => onToggleRow(row.id, index, shiftKey)}
                        />
                      </BoardCheckboxCell>
                      <td className="mono import-sea-col-bref">
                        <BookingRefCell
                          bookingId={row.id}
                          value={row.booking_ref}
                          onHold={onHold}
                          matched={row.matched}
                          boardParams={searchParams}
                        />
                        {row.archived_at ? (
                          <Archive size={12} className="text-muted-foreground" aria-label="Archived" />
                        ) : null}
                      </td>
                      <td className="mono import-sea-col-job" onClick={(e) => e.stopPropagation()}>
                        {row.job_no ?? '—'}
                      </td>
                      <td className="import-sea-col-client">
                        <ClientCell
                          customerId={row.customer_id}
                          name={row.customer_name}
                        />
                      </td>
                      <td className={flashClass(isCellFlashing(row.id, 'eta'))}>
                        <BoardSourcedDateCell
                          value={row.eta}
                          source={row.eta_source}
                          lastSync={row.portconnect_last_sync}
                        />
                      </td>
                      <td className={flashClass(isCellFlashing(row.id, 'containers'))}>
                        <ContainerCell containers={row.containers} lastSync={row.portconnect_last_sync} />
                      </td>
                      <td className={flashClass(isCellFlashing(row.id, 'atf'))}>
                        {(() => {
                          const code = row.m_atf?.trim()
                          if (!code) return <span className="muted">–</span>
                          const ubf = code === '31853'
                          return (
                            <span
                              title={ubf ? 'UBF yard (ATF 31853)' : `Client facility (ATF ${code})`}
                              style={{
                                display: 'inline-flex',
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                background: ubf ? '#DCFAE6' : '#EFF8FF',
                                color: ubf ? '#067647' : '#175CD3',
                              }}
                            >
                              {ubf ? 'UBF' : 'Client'}
                            </span>
                          )
                        })()}
                      </td>
                      <td>
                        {row.m_atf?.trim() === '31853'
                          ? (row.ubf_devanner?.trim()
                              ? <span
                                  style={{
                                    display: 'inline-flex', padding: '2px 8px', borderRadius: 999,
                                    fontSize: 11, fontWeight: 600,
                                    background: '#F2F4F7', color: '#344054',
                                  }}
                                >{row.ubf_devanner}</span>
                              : <span className="muted">–</span>)
                          : <span className="muted">–</span>}
                      </td>
                      <td className={flashClass(isCellFlashing(row.id, 'last_free_day'))}>
                        <BoardSourcedDateCell
                          value={row.last_free_day}
                          source={row.last_free_day_source}
                          lastSync={row.portconnect_last_sync}
                          lfd
                        />
                      </td>
                      <td className={flashClass(isCellFlashing(row.id, 'delivery_date'))}>
                        <BoardSourcedDateCell
                          value={row.delivery_date}
                          source={row.delivery_date_source}
                          lastSync={row.portconnect_last_sync}
                        />
                      </td>
                      <td className={flashClass(isCellFlashing(row.id, 'container_return_date'))}>
                        <BoardDateCell value={row.container_return_date} />
                      </td>
                      <td><HoldCell label={row.hold_label} /></td>
                      <td><ImportSeaOpsStatus row={row} /></td>
                      <td className="import-sea-col-inv" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={Boolean(row.inv_approved)}
                          onCheckedChange={(v) => onToggleInvoice(row.id, 'inv_approved', v)}
                          aria-label="Invoice passed for approval"
                        />
                      </td>
                      <td className="import-sea-col-inv" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={Boolean(row.inv_sent)}
                          onCheckedChange={(v) => onToggleInvoice(row.id, 'inv_sent', v)}
                          aria-label="Invoice sent to customer"
                        />
                      </td>
                      <td className="import-sea-col-refresh">
                        <ImportSeaRowRefreshCell
                          row={row}
                          busy={isRowRefreshing(row.id)}
                          cooldownSec={rowRefreshCooldownSec(row.id)}
                          onRefresh={() => onRefreshRow(row)}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </SkeletonBusy>
      </div>
    </TooltipProvider>
  )
}
