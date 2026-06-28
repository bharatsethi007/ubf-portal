import type {
  BookingMeta,
  ConfirmationDraftContext,
  IntelligenceBookingSnapshot,
  IntelligenceNote,
  PartyIntelDisplay,
} from './types'

function fmtIntelDate(value: string | null | undefined): string {
  if (!value?.trim()) return '-'
  const iso = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-NZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function pick(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return '-'
}

function display(value: string | number | null | undefined): string {
  if (value == null || value === '') return '-'
  return String(value)
}

export function buildConfirmationMailto(args: {
  meta: BookingMeta | null
  booking: IntelligenceBookingSnapshot
  supplier: PartyIntelDisplay | null
  consignee: PartyIntelDisplay | null
}): string | null {
  try {
    const { meta, booking, supplier, consignee } = args
    const to = [consignee?.email, supplier?.email]
      .map((e) => e?.trim())
      .filter((e): e is string => Boolean(e))
      .join(',')

    const origin = display(booking.origin)
    const destination = display(booking.destination)
    const subject = `Booking Confirmation – ${display(booking.bookingRef)} – ${origin} to ${destination}`
    const modeLabel = meta?.mode_label?.trim() || '-'

    const body = [
      'Hi,',
      '',
      'Please find the booking confirmation below.',
      '',
      `Booking Ref: ${display(booking.bookingRef)}`,
      `Service: ${display(booking.serviceType)}`,
      `Mode: ${modeLabel}`,
      `Origin: ${origin}`,
      `Destination: ${destination}`,
      `Incoterm: ${display(booking.incoterm)}`,
      `Airline/Vessel: ${pick(booking.airlineName, booking.vessel)}`,
      `Flight/Voyage: ${pick(booking.flightNo, booking.voyage)}`,
      `Cargo Ready: ${fmtIntelDate(booking.cargoReadyDate)}`,
      `ETD: ${fmtIntelDate(booking.etd)}   ETA: ${fmtIntelDate(booking.eta)}`,
      `Shipper: ${supplier?.name?.trim() || display(booking.accountId)}`,
      `Consignee: ${consignee?.name?.trim() || '-'}`,
      `Pieces: ${display(booking.pieces)}   Weight: ${display(booking.weightKg)} kg   CBM: ${display(booking.cbm ?? booking.volumeM3)}`,
      `Goods: ${display(booking.goodsDescription)}`,
      '',
      'Kind regards,',
      'UB Freight',
    ].join('\n')

    const params = new URLSearchParams()
    const cc = meta?.ops_mailbox?.trim()
    if (cc) params.set('cc', cc)
    params.set('subject', subject)
    params.set('body', body)

    return to ? `mailto:${to}?${params.toString()}` : `mailto:?${params.toString()}`
  } catch {
    return null
  }
}

export function buildIntelligenceNotes(meta: BookingMeta | null): IntelligenceNote[] {
  const mailbox = meta?.ops_mailbox?.trim()
  if (!mailbox) return []

  return [
    {
      text: `Send booking confirmation to ${mailbox}`,
      cta: { label: 'Draft confirmation' },
    },
  ]
}

export function openConfirmationDraft(ctx: ConfirmationDraftContext): void {
  const mailto = buildConfirmationMailto(ctx)
  if (!mailto) return
  window.location.href = mailto
}
