import type { BookingFormState } from '../../../pages/bookings/bookingFormState'
import type { IntelligenceBookingMeta } from './types'

export type { IntelligenceBookingMeta } from './types'

function trimId(value?: string | null): string | undefined {
  const id = value?.trim()
  return id || undefined
}

/**
 * Party ids for intelligence RPCs — always prefer live form selections over
 * saved booking row fields. booking.account_id is the consignee on save, not
 * the shipper, so never use meta.accountId as the non-consol supplier id.
 */
export function resolveIntelligencePartyIds(
  state: BookingFormState,
  meta: IntelligenceBookingMeta = {},
): { supplierAccountId?: string; consigneeAccountId?: string } {
  const consigneeAccountId =
    trimId(state.consigneeCustomer?.account_id) ?? trimId(meta.consigneeAccountId)

  let supplierAccountId: string | undefined
  if (state.isConsolidation) {
    supplierAccountId =
      trimId(state.suppliers?.find((s) => s.customer?.account_id)?.customer?.account_id) ??
      trimId(meta.firstSupplierAccountId)
  } else {
    supplierAccountId =
      trimId(state.shipperCustomer?.account_id) ?? trimId(meta.firstSupplierAccountId)
  }

  return { supplierAccountId, consigneeAccountId }
}
