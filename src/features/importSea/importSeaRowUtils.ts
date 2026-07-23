import { fmtShort } from '../../utils/format'
import type { ImportSeaRow } from './types'

export function containerSummary(containers: ImportSeaRow['containers']): string {
  if (!containers?.length) return '—'
  const first = containers[0]?.container_no?.trim()
  if (!first) return '—'
  const extra = containers.length - 1
  return extra > 0 ? `${first} +${extra}` : first
}

export function lfdClass(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  d.setHours(12, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return 'import-sea-lfd--past'
  if (diff <= 2) return 'import-sea-lfd--warn'
  return ''
}

export function exportImportSeaCsv(rows: ImportSeaRow[]): void {
  const headers = [
    'Booking ref',
    'Client',
    'Container',
    'ETA',
    'ATF',
    'LFD',
    'Delivery',
    'Return',
    'Hold',
    'Handled by',
    'SWB',
    'TLX',
    'BACC',
    'Port cleared',
    'Line released',
    'UBF cleared',
    'Truck booked',
  ]
  const lines = rows.map((r) => [
    r.booking_ref ?? '',
    r.customer_name ?? '',
    containerSummary(r.containers),
    fmtShort(r.eta),
    r.atf ?? '',
    fmtShort(r.last_free_day),
    fmtShort(r.delivery_date),
    fmtShort(r.container_return_date),
    r.hold_label ?? '',
    r.handler_name ?? '',
    r.swb_released ? 'Y' : '',
    r.tlx_release_on_hand ? 'Y' : '',
    r.bacc_sent ? 'Y' : '',
    r.port_cleared ? 'Y' : '',
    r.line_released ? 'Y' : '',
    r.cleared ? 'Y' : '',
    r.truck_booked ? 'Y' : '',
  ])
  const csv = [headers, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `import-sea-board-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
