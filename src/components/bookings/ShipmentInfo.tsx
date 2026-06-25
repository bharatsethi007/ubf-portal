import { Plane } from 'lucide-react'
import AirlineSelect from './AirlineSelect'
import IncotermSelect from './IncotermSelect'
import IataPortSelect from './IataPortSelect'
import { SectionCard } from './SectionCard'
import ServiceTypeSegment from './ServiceTypeSegment'
import { FormField, TextInput } from './FormField'
import type { FieldErrors } from './bookingFormValidation'
import type { BookingFormState } from '../../pages/bookings/bookingFormState'
import type { BookingServiceType } from '../../types/booking'

type Props = {
  state: BookingFormState
  set: (patch: Partial<BookingFormState>) => void
  useIata: boolean
  errors?: FieldErrors
  showErrors?: boolean
}

export default function ShipmentInfo({ state, set, useIata, errors = {}, showErrors }: Props) {
  return (
    <SectionCard id="shipment" title="Shipment info">
      <ServiceTypeSegment
        value={state.serviceType}
        onChange={(v: BookingServiceType) => set({ serviceType: v })}
      />
      {showErrors && errors.serviceType && <p className="bf-field__error">{errors.serviceType}</p>}

      <div className="bf-lane-row">
        <div className="bf-lane-row__ports">
          {useIata ? (
            <>
              <FormField label="Origin" required error={errors.origin} showError={showErrors}>
                <IataPortSelect value={state.origin} onChange={(v) => set({ origin: v })} required />
              </FormField>
              <Plane size={18} className="bf-lane-row__plane" style={{ transform: 'rotate(45deg)' }} aria-hidden />
              <FormField label="Destination" required error={errors.destination} showError={showErrors}>
                <IataPortSelect value={state.destination} onChange={(v) => set({ destination: v })} required />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Origin" required error={errors.origin} showError={showErrors} className="bf-field--w56">
                <TextInput value={state.origin} onChange={(v) => set({ origin: v })} showError={showErrors} error={Boolean(errors.origin)} />
              </FormField>
              <Plane size={18} className="bf-lane-row__plane" style={{ transform: 'rotate(45deg)' }} aria-hidden />
              <FormField label="Destination" required error={errors.destination} showError={showErrors} className="bf-field--w56">
                <TextInput value={state.destination} onChange={(v) => set({ destination: v })} showError={showErrors} error={Boolean(errors.destination)} />
              </FormField>
            </>
          )}
        </div>
      </div>

      <div className="bf-inline-row">
        <FormField label="Incoterm" className="bf-field--w56">
          <IncotermSelect value={state.incoterm} onChange={(v) => set({ incoterm: v })} />
        </FormField>
        <FormField label="Airline" className="bf-field--w40">
          <AirlineSelect
            value={state.airline}
            onChange={(code, name) => set({ airline: code, airlineName: name ?? '' })}
          />
        </FormField>
        <FormField label="Flight No" className="bf-field--w32">
          <TextInput value={state.flightNo} onChange={(v) => set({ flightNo: v })} />
        </FormField>
      </div>
      <div className="bf-inline-row">
        <FormField label="Cargo Ready Date" className="bf-field--w44">
          <input className="bf-input bf-input--date" type="date" value={state.cargoReadyDate} onChange={(e) => set({ cargoReadyDate: e.target.value })} />
        </FormField>
        <FormField label="ETD" className="bf-field--w44">
          <input className="bf-input bf-input--date" type="date" value={state.etd} onChange={(e) => set({ etd: e.target.value })} />
        </FormField>
        <FormField label="ETA" className="bf-field--w44">
          <input className="bf-input bf-input--date" type="date" value={state.eta} onChange={(e) => set({ eta: e.target.value })} />
        </FormField>
      </div>
    </SectionCard>
  )
}
