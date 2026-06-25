import type { Booking, BookingModule, BookingSupplier } from '../../types/booking'
import { MODULE_CONFIG } from '../../types/booking'
import type { ExporterLineState } from './ExporterLines'

export type PayerChoice = 'importer' | 'exporter' | 'other'

export type BookingFormState = {
  module: BookingModule
  importerCustomer: { account_id: string; name: string } | null
  importerNameOverride: string
  isConsolidation: boolean
  exporters: ExporterLineState[]
  payer: PayerChoice
  payerOther: { account_id: string; name: string } | null
  origin: string
  destination: string
  incoterm: string
  commodity: string
  pieces: string
  weight_kg: string
  volume_m3: string
  chargeable_weight_kg: string
  container_type: string
  container_count: string
  vessel_flight: string
  etd: string
  eta: string
  special_instructions: string
}

export function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function parseOptionalInt(raw: string): number | null {
  const n = parseOptionalNumber(raw)
  return n == null ? null : Math.trunc(n)
}

function trimOrNull(s: string): string | null {
  const t = s.trim()
  return t || null
}

function resolveImporterName(state: BookingFormState): string | null {
  return trimOrNull(state.importerNameOverride) ?? state.importerCustomer?.name ?? null
}

function resolvePayerAccountId(state: BookingFormState): string | null {
  if (state.payer === 'importer') return state.importerCustomer?.account_id ?? null
  if (state.payer === 'exporter') return state.exporters[0]?.customer?.account_id ?? null
  return state.payerOther?.account_id ?? null
}

export function validateBookingForm(state: BookingFormState): { blocking: string; warnings: string[] } {
  const warnings: string[] = []
  const cfg = MODULE_CONFIG[state.module]

  if (!resolveImporterName(state)) {
    return { blocking: 'Importer is required.', warnings }
  }

  const hasExporter = state.exporters.some((line) => line.customer?.name?.trim())
  if (!hasExporter) {
    return { blocking: 'At least one exporter with a name is required.', warnings }
  }

  if (state.origin.trim() && state.origin.trim().length !== cfg.portLen) {
    warnings.push(`Origin should be ${cfg.portLen} characters (${cfg.portKind}).`)
  }
  if (state.destination.trim() && state.destination.trim().length !== cfg.portLen) {
    warnings.push(`Destination should be ${cfg.portLen} characters (${cfg.portKind}).`)
  }

  return { blocking: '', warnings }
}

export function buildBookingPayload(state: BookingFormState): Partial<Booking> {
  const cfg = MODULE_CONFIG[state.module]
  const isSea = cfg.mode === 'sea'
  const isAir = cfg.mode === 'air'

  return {
    module: state.module,
    source: 'manual',
    status: 'new',
    account_id: resolvePayerAccountId(state),
    importer_name: resolveImporterName(state),
    importer_account_id: state.importerCustomer?.account_id ?? null,
    is_consolidation: state.isConsolidation,
    origin: trimOrNull(state.origin),
    destination: trimOrNull(state.destination),
    incoterm: trimOrNull(state.incoterm),
    commodity: trimOrNull(state.commodity),
    pieces: parseOptionalInt(state.pieces),
    weight_kg: parseOptionalNumber(state.weight_kg),
    volume_m3: isSea ? parseOptionalNumber(state.volume_m3) : null,
    chargeable_weight_kg: isAir ? parseOptionalNumber(state.chargeable_weight_kg) : null,
    container_type: isSea ? trimOrNull(state.container_type) : null,
    container_count: isSea ? parseOptionalInt(state.container_count) : null,
    vessel_flight: trimOrNull(state.vessel_flight),
    etd: trimOrNull(state.etd),
    eta: trimOrNull(state.eta),
    special_instructions: trimOrNull(state.special_instructions),
  }
}

export function buildExporterRows(lines: ExporterLineState[]): BookingSupplier[] {
  return lines
    .filter((line) => line.customer?.name?.trim())
    .map((line) => ({
      id: '',
      booking_id: '',
      ord: 0,
      supplier_name: line.customer?.name ?? null,
      supplier_account_id: line.customer?.account_id ?? null,
      supplier_address: trimOrNull(line.supplier_address),
      pickup_location: trimOrNull(line.pickup_location),
      po_number: trimOrNull(line.po_number),
      commodity: trimOrNull(line.commodity),
      pieces: parseOptionalInt(line.pieces),
      weight_kg: parseOptionalNumber(line.weight_kg),
      volume_m3: parseOptionalNumber(line.volume_m3),
    }))
}
