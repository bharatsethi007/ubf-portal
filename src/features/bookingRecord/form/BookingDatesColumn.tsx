import { useMemo } from 'react'
import { aggregatePortConnectBookingFields } from '../portConnect/bookingPortConnectCoalesce'
import { portConnectLastSync } from '../portConnect/portConnectProvenance'
import type { PortConnectFieldKey } from '../portConnect/portConnectProvenance'
import { withFieldOverride } from '../bookingFieldOverrides'
import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'
import { isLytteltonPort } from '../tracking/portconnectUtils'
import TriSourceDateField from './TriSourceDateField'
import ImportSeaDateField from '@/features/importSea/ImportSeaDateField'
import FormCard from './FormCard'
import BookingFieldShell from './BookingFieldShell'
import PortConnectSourcePill from '../portConnect/PortConnectSourcePill'

/** "02 Oct 2026, 14:14" in NZ time, same day format as the other date fields. */
function fmtGate(ts: string): string {
  const d = new Date(ts)
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Pacific/Auckland', day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland', hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day}, ${time}`
}

/** Read-only: latest PortConnect gate-out across the booking's containers; per-box times on hover. */
function GateOutField({ rows, lastSync }: { rows: ContainerTrackingRow[] | null | undefined; lastSync: string | null | undefined }) {
  const all = rows ?? []
  const out = all.filter((r) => r.gate_out_at).sort((a, b) => (b.gate_out_at ?? '').localeCompare(a.gate_out_at ?? ''))
  const latest = out[0]?.gate_out_at ?? null
  const partial = all.length > 1 && out.length > 0 && out.length < all.length
  const title = out.map((r) => `${r.container_no}: ${fmtGate(r.gate_out_at as string)}`).join('\n')
  return (
    <BookingFieldShell label="Gate out" provenance={latest ? <PortConnectSourcePill lastSync={lastSync} /> : null}>
      <div className="booking-erp-readonly" title={title || undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={latest ? 'mono' : 'muted'}>{latest ? fmtGate(latest) : 'Not yet'}</span>
        {partial ? <span style={{ fontSize: 10.5, color: '#B54708' }}>{out.length} of {all.length} out</span> : null}
      </div>
    </BookingFieldShell>
  )
}

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  booking: BookingRecord
  dischargePort: string | null
  trackingContainers: ContainerTrackingRow[] | null | undefined
  lastSync?: string | null
  isFlashing?: (key: PortConnectFieldKey) => boolean
  onPatch: PatchFn
}

export default function BookingDatesColumn({
  booking,
  dischargePort,
  trackingContainers,
  lastSync: lastSyncProp,
  isFlashing,
  onPatch,
}: Props) {
  const lyttelton = isLytteltonPort(dischargePort)
  const overrides = booking.field_overrides
  const lastSync = lastSyncProp ?? portConnectLastSync(trackingContainers)
  const pc = useMemo(
    () => aggregatePortConnectBookingFields(trackingContainers, dischargePort),
    [trackingContainers, dischargePort],
  )

  const patchDb = (db: BookingRecordPatch) => {
    onPatch(db as Partial<BookingRecord>, db)
  }

  return (
    <div className="booking-details-col">
      <FormCard title="Dates">
        <div className="booking-lfd-field">
          {lyttelton || !pc?.lastFreeDay ? (
            <ImportSeaDateField
              label="Last free day"
              value={booking.last_free_day}
              onChange={(iso) =>
                patchDb(withFieldOverride({ last_free_day: iso }, 'last_free_day', overrides))
              }
            />
          ) : (
            <TriSourceDateField
              label="Last free day"
              portConnectValue={pc.lastFreeDay}
              manualValue={booking.last_free_day}
              overrideField="last_free_day"
              fieldOverrides={overrides}
              lastSync={lastSync}
              flash={isFlashing?.('last_free_day')}
              onPatch={patchDb}
            />
          )}
          {lyttelton ? (
            <p className="booking-lfd-field__note muted">
              Lyttelton (NZLYT) — PortConnect does not send LFT events. Enter last free day manually.
            </p>
          ) : null}
        </div>
        <TriSourceDateField
          label="Discharge date"
          portConnectValue={pc?.dischargeDate ?? null}
          manualValue={booking.discharge_date}
          overrideField="discharge_date"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('discharge_date')}
          onPatch={patchDb}
        />
        <GateOutField rows={trackingContainers} lastSync={lastSync} />
        <TriSourceDateField
          label="Container return"
          portConnectValue={pc?.containerReturnDate ?? null}
          manualValue={booking.container_return_date}
          overrideField="container_return_date"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('container_return_date')}
          onPatch={patchDb}
        />
        <ImportSeaDateField
          label="Doc handover"
          value={booking.doc_handover_at?.slice(0, 10) ?? null}
          onChange={(iso) =>
            onPatch(
              { doc_handover_at: iso ? `${iso}T12:00:00Z` : null },
              { doc_handover_at: iso ? `${iso}T12:00:00Z` : null },
            )
          }
        />
      </FormCard>
    </div>
  )
}
