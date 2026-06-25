import type { BookingFormState } from '../../pages/bookings/bookingFormState'

export type SectionKey =
  | 'shipment'
  | 'shipper'
  | 'consignee'
  | 'cargo'
  | 'notes'

export const FORM_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'shipment', label: 'Shipment' },
  { key: 'shipper', label: 'Shipper' },
  { key: 'consignee', label: 'Consignee' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'notes', label: 'Notes' },
]

export type FieldErrors = Record<string, string>

export function isSectionComplete(key: SectionKey, state: BookingFormState): boolean {
  switch (key) {
    case 'shipment':
      return Boolean(state.serviceType && state.origin.trim() && state.destination.trim())
    case 'shipper':
      return state.isConsolidation
        ? state.suppliers.some((s) => Boolean(s.customer?.account_id))
        : Boolean(state.shipperCustomer?.account_id)
    case 'consignee':
      return Boolean(state.consigneeCustomer?.account_id)
    default:
      return true
  }
}

export function validateSubmit(state: BookingFormState): FieldErrors {
  const errors: FieldErrors = {}
  if (!state.serviceType) errors.serviceType = 'Select a service type'
  if (!state.origin.trim()) errors.origin = 'Origin is required'
  if (!state.destination.trim()) errors.destination = 'Destination is required'
  if (state.isConsolidation) {
    if (!state.suppliers.some((s) => s.customer?.account_id)) {
      errors.shipperCustomer = 'Add at least one supplier'
    }
  } else if (!state.shipperCustomer?.account_id) {
    errors.shipperCustomer = 'Shipper is required'
  }
  if (!state.consigneeCustomer?.account_id) {
    errors.consigneeCustomer = 'Consignee is required'
  }
  return errors
}
