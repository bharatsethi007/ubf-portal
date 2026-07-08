import type { BookingFormState } from '../../pages/bookings/bookingFormState'
import { FormField, TextInput, ToggleSwitch } from './FormField'

type Props = {
  state: BookingFormState
  set: (patch: Partial<BookingFormState>) => void
}

export default function CargoHandling({ state, set }: Props) {
  return (
    <div className="bf-cargo-handling">
      <FormField label="Packing type" className="bf-field--w48">
        <TextInput
          value={state.packingType}
          placeholder="e.g. pallets, cartons, crates"
          onChange={(v) => set({ packingType: v })}
        />
      </FormField>
      <div className="bf-cargo-handling__toggles">
        <div className="bf-toggle--chip">
          <ToggleSwitch label="Dangerous goods" checked={state.isDg} onChange={(v) => set({ isDg: v })} />
        </div>
        <div className="bf-toggle--chip">
          <ToggleSwitch label="Temperature controlled" checked={state.isTempControlled} onChange={(v) => set({ isTempControlled: v })} />
        </div>
        <div className="bf-toggle--chip">
          <ToggleSwitch label="Valuable cargo" checked={state.isValuable} onChange={(v) => set({ isValuable: v })} />
        </div>
        <div className="bf-toggle--chip">
          <ToggleSwitch label="Out of gauge" checked={state.isOog} onChange={(v) => set({ isOog: v })} />
        </div>
      </div>
      {(state.isDg || state.isTempControlled) && (
        <div className="bf-cargo-handling__reveals">
          {state.isDg && (
            <div className="bf-cargo-handling__inline">
              <FormField label="UN number">
                <TextInput value={state.unNumber} onChange={(v) => set({ unNumber: v })} />
              </FormField>
              <FormField label="DG class">
                <TextInput value={state.dgClass} onChange={(v) => set({ dgClass: v })} />
              </FormField>
            </div>
          )}
          {state.isTempControlled && (
            <FormField label="Temp range" className="bf-field--w48">
              <TextInput value={state.tempRange} onChange={(v) => set({ tempRange: v })} />
            </FormField>
          )}
        </div>
      )}
    </div>
  )
}
