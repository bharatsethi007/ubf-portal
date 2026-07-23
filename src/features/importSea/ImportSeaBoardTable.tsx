import { SkeletonBusy } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ImportSeaBoardTableSkeleton from './ImportSeaBoardTableSkeleton'
import BookingRefCell from './cells/BookingRefCell'
import BoardDateCell from './cells/BoardDateCell'
import ClientCell from './cells/ClientCell'
import ContainerCell from './cells/ContainerCell'
import HandledByCell from './cells/HandledByCell'
import HoldCell from './cells/HoldCell'
import { bookingRecordHref } from './importSeaFilterUrl'
import ImportSeaOpsStatus from './ImportSeaOpsStatus'
import type { ImportSeaRow } from './types'

const COL_SPAN = 11

type Props = {
  rows: ImportSeaRow[]
  loading: boolean
}

export default function ImportSeaBoardTable({ rows, loading }: Props) {
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
                <th>Booking ref</th>
                <th className="import-sea-col-client">Client</th>
                <th>ETA</th>
                <th>Container</th>
                <th>ATF</th>
                <th>LFD</th>
                <th>Delivery</th>
                <th>Return</th>
                <th>Hold</th>
                <th>Handled by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <ImportSeaBoardTableSkeleton />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COL_SPAN} className="muted pad-inline">
                    No bookings match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const onHold = Boolean(row.hold_code)

                  return (
                    <tr
                      key={row.id}
                      className={`row-clickable${onHold ? ' import-sea-row--hold' : ''}`}
                      onClick={() => openRecord(row.id)}
                    >
                      <td className="mono">
                        <BookingRefCell
                          bookingId={row.id}
                          value={row.booking_ref}
                          onHold={onHold}
                          matched={row.matched}
                          boardParams={searchParams}
                        />
                      </td>
                      <td className="import-sea-col-client">
                        <ClientCell
                          customerId={row.customer_id}
                          name={row.customer_name}
                        />
                      </td>
                      <td><BoardDateCell value={row.eta} /></td>
                      <td><ContainerCell containers={row.containers} /></td>
                      <td><BoardDateCell value={row.atf} /></td>
                      <td><BoardDateCell value={row.last_free_day} lfd /></td>
                      <td><BoardDateCell value={row.delivery_date} /></td>
                      <td><BoardDateCell value={row.container_return_date} /></td>
                      <td><HoldCell label={row.hold_label} /></td>
                      <td>
                        <HandledByCell
                          initials={row.handler_initials}
                          name={row.handler_name}
                        />
                      </td>
                      <td><ImportSeaOpsStatus row={row} /></td>
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
