import { computeCargoTotals, isCargoLineEmpty } from '../cargoLineUtils'
import type { BookingFormState } from '../../../pages/bookings/bookingFormState'
import type { CargoLineRow } from '../../../types/bookingCargoLine'
import type { IntelligenceBookingMeta, IntelligenceBookingSnapshot } from './types'

function trimOrNull(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

export function buildIntelligenceBookingSnapshot(
  state: BookingFormState,
  cargoLines: CargoLineRow[],
  meta: IntelligenceBookingMeta,
  supplierAccountId?: string,
): IntelligenceBookingSnapshot {
  try {
    const activeLines = (cargoLines ?? []).filter((row) => row && !isCargoLineEmpty(row))
    const totals = computeCargoTotals(activeLines)
    const firstDesc =
      activeLines.find((row) => row.goodsDesc?.trim())?.goodsDesc.trim() ?? null

    return {
      bookingRef: meta.bookingRef ?? null,
      origin: trimOrNull(state.origin),
      destination: trimOrNull(state.destination),
      serviceType: state.serviceType || null,
      incoterm: trimOrNull(state.incoterm),
      airlineName: trimOrNull(state.airlineName),
      vessel: meta.vessel ?? null,
      flightNo: trimOrNull(state.flightNo),
      voyage: meta.voyage ?? null,
      cargoReadyDate: state.cargoReadyDate || null,
      etd: state.etd || null,
      eta: state.eta || null,
      accountId: supplierAccountId ?? meta.accountId ?? null,
      pieces: totals.totalPieces != null ? Math.trunc(totals.totalPieces) : null,
      weightKg: totals.totalWeightKg,
      cbm: totals.totalCbm,
      volumeM3: totals.totalCbm,
      goodsDescription: firstDesc,
    }
  } catch {
    return {}
  }
}
