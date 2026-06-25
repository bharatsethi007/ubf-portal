import IataPortSelect from '../../../components/bookings/IataPortSelect'
import { SectionCard, FormField, TextInput, SERVICE_TYPES, type SectionProps } from '../formUi'

type Props = SectionProps & { useIata: boolean }

export default function ShipmentInfoSection({ state, set, useIata, errors = {}, showErrors }: Props) {
  const originField = useIata ? (
    <FormField label="Origin (IATA)" required error={errors.origin} showError={showErrors}>
      <IataPortSelect label="" value={state.origin} onChange={(v) => set({ origin: v })} required />
    </FormField>
  ) : (
    <FormField label="Origin (UNLOCODE)" required error={errors.origin} showError={showErrors}>
      <TextInput
        value={state.origin}
        onChange={(v) => set({ origin: v })}
        showError={showErrors}
        error={Boolean(errors.origin)}
      />
    </FormField>
  )

  const destField = useIata ? (
    <FormField label="Destination (IATA)" required error={errors.destination} showError={showErrors}>
      <IataPortSelect label="" value={state.destination} onChange={(v) => set({ destination: v })} required />
    </FormField>
  ) : (
    <FormField label="Destination (UNLOCODE)" required error={errors.destination} showError={showErrors}>
      <TextInput
        value={state.destination}
        onChange={(v) => set({ destination: v })}
        showError={showErrors}
        error={Boolean(errors.destination)}
      />
    </FormField>
  )

  return (
    <SectionCard id="shipment" title="Shipment info">
      <div className="bf-radios bf-radios--compact">
        {SERVICE_TYPES.map(({ value, label }) => (
          <label key={value} className="bf-radio">
            <input
              type="radio"
              name="serviceType"
              checked={state.serviceType === value}
              onChange={() => set({ serviceType: value })}
            />
            {label}
          </label>
        ))}
      </div>
      {showErrors && errors.serviceType && (
        <p className="bf-field__error">{errors.serviceType}</p>
      )}

      <div className="bf-grid bf-grid--3 bf-grid--tight bf-shipment-grid">
        {originField}
        {destField}
        <FormField label="Incoterm">
          <TextInput value={state.incoterm} placeholder="EXW, FOB, CIF…" onChange={(v) => set({ incoterm: v })} />
        </FormField>
        <FormField label="Airline"><TextInput value={state.airline} onChange={(v) => set({ airline: v })} /></FormField>
        <FormField label="Flight No"><TextInput value={state.flightNo} onChange={(v) => set({ flightNo: v })} /></FormField>
        <FormField label="ETD">
          <input className="bf-input bf-input--date" type="date" value={state.etd} onChange={(e) => set({ etd: e.target.value })} />
        </FormField>
        <FormField label="ETA">
          <input className="bf-input bf-input--date" type="date" value={state.eta} onChange={(e) => set({ eta: e.target.value })} />
        </FormField>
      </div>
    </SectionCard>
  )
}
