import type { FieldErrors } from '../../components/bookings/bookingFormValidation'
import type { BookingFormState } from './bookingFormState'

export type SectionProps = {
  state: BookingFormState
  set: (patch: Partial<BookingFormState>) => void
  errors?: FieldErrors
  showErrors?: boolean
}

export { FormField, TextInput, ToggleSwitch, ToggleRow } from '../../components/bookings/FormField'
export { SectionCard } from '../../components/bookings/SectionCard'

export const SERVICE_TYPES = [
  { value: 'door-door', label: 'Door to door' },
  { value: 'door-port', label: 'Door to port' },
  { value: 'port-door', label: 'Port to door' },
  { value: 'port-port', label: 'Port to port' },
] as const
