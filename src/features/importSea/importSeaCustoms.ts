import { supabase } from '../../supabase'

/** Customs entry (TradeWindow CUSTMAIN) on the booking's job, from v_booking_customs. */
export type BookingCustoms = {
  customs_status: string | null
  customs_status_label: string | null
  mpi_status: string | null
  mpi_status_label: string | null
  mpi_food_status: string | null
  mpi_food_status_label: string | null
  clear_date: string | null
  closed: boolean | null
  /** From TSW responses (CF CUSTOMS_MSGS_RES1). */
  entry_number?: string | null
  customs_released_at?: string | null
  mpi_bio_cleared_at?: string | null
  mpi_food_cleared_at?: string | null
  bacc_number?: string | null
  facc_number?: string | null
}

export type CustomsPillState = 'on' | 'warn' | 'off'

/** One entry per job. Only bookings with an entry come back, so this stays small. */
export async function fetchBookingCustoms(bookingId?: string): Promise<Map<string, BookingCustoms>> {
  let q = supabase
    .from('v_booking_customs')
    .select('booking_id, customs_status, customs_status_label, mpi_status, mpi_status_label, mpi_food_status, mpi_food_status_label, clear_date, closed, entry_number, customs_released_at, mpi_bio_cleared_at, mpi_food_cleared_at, bacc_number, facc_number')
  if (bookingId) q = q.eq('booking_id', bookingId)
  const { data } = await q
  const out = new Map<string, BookingCustoms>()
  for (const r of (data ?? []) as (BookingCustoms & { booking_id: string })[]) {
    const { booking_id, ...rest } = r
    out.set(booking_id, rest)
  }
  return out
}

/** 819 delivery order = on. 822 cleared but cash to pay, 814 cancelled = warn. Else off. */
export function customsState(c: BookingCustoms | null | undefined): CustomsPillState {
  const s = c?.customs_status
  if (s === '819') return 'on'
  if (s === '822' || s === '814') return 'warn'
  return 'off'
}

/** Biosecurity B04/B06 cleared = on. B05 or food F05 directions = warn. Else off. */
export function mpiState(c: BookingCustoms | null | undefined): CustomsPillState {
  if (!c) return 'off'
  if (c.mpi_status === 'B05' || c.mpi_food_status === 'F05') return 'warn'
  if (c.mpi_status === 'B04' || c.mpi_status === 'B06') return 'on'
  return 'off'
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

export function customsTooltip(c: BookingCustoms | null | undefined): string {
  if (!c) return 'Customs: no entry in CyberFreight'
  const label = c.customs_status_label ?? (c.customs_status ? c.customs_status : 'Entry not lodged yet')
  const cleared = c.clear_date ? `. Cleared ${fmtDate(c.clear_date)}` : ''
  return `Customs: ${label}${cleared}`
}

export function mpiTooltip(c: BookingCustoms | null | undefined): string {
  if (!c) return 'MPI: no entry in CyberFreight'
  const bio = c.mpi_status_label ?? 'Biosecurity: no response yet'
  const food = c.mpi_food_status_label ? `. ${c.mpi_food_status_label}` : ''
  return `${bio}${food}`
}
