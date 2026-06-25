import AddressAutocomplete from './AddressAutocomplete'
import CustomerPicker, { type CustomerPickerValue } from './CustomerPicker'
import { FormField, TextInput } from './FormField'

export type AddressComponents = {
  city?: string
  state?: string
  postcode?: string
  country?: string
}

export type PartyValues = {
  customer: CustomerPickerValue | null
  contact: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  postcode: string
  country: string
}

type Props = {
  pickerLabel: string
  values: PartyValues
  onCustomerChange: (c: CustomerPickerValue | null) => void
  onChange: (patch: Partial<PartyValues>) => void
  customerRequired?: boolean
  customerError?: string
  showErrors?: boolean
}

export default function PartyBlock({
  pickerLabel,
  values,
  onCustomerChange,
  onChange,
  customerRequired,
  customerError,
  showErrors,
}: Props) {
  function applyAddress(address: string, c?: AddressComponents) {
    if (c) {
      onChange({
        address,
        city: c.city ?? values.city,
        state: c.state ?? values.state,
        postcode: c.postcode ?? values.postcode,
        country: c.country ?? values.country,
      })
    } else {
      onChange({ address })
    }
  }

  return (
    <div className="bf-party bf-party--compact">
      <div className="bf-inline-row">
        <FormField label="" error={customerError} showError={showErrors} required={customerRequired} className="bf-field--w72">
          <CustomerPicker compact label={pickerLabel} required={customerRequired} value={values.customer} onChange={onCustomerChange} />
        </FormField>
        <FormField label="Contact" className="bf-field--w48">
          <TextInput value={values.contact} onChange={(v) => onChange({ contact: v })} />
        </FormField>
        <FormField label="Phone" className="bf-field--w40">
          <TextInput value={values.phone} onChange={(v) => onChange({ phone: v })} />
        </FormField>
        <FormField label="Email" className="bf-field--w56">
          <TextInput value={values.email} onChange={(v) => onChange({ email: v })} />
        </FormField>
      </div>
      <FormField label="Address" className="bf-field--full">
        <AddressAutocomplete label="" value={values.address} onChange={applyAddress} />
      </FormField>
    </div>
  )
}
