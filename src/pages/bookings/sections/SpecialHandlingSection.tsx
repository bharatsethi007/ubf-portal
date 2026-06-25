import { SectionCard, FormField, TextInput, ToggleSwitch, type SectionProps } from '../formUi'

export default function SpecialHandlingSection({ state, set }: SectionProps) {
  return (
    <SectionCard id="special" title="Special handling">
      <div className="bf-special">
        <div className="bf-special__grid">
          <div className="bf-special__cell">
            <ToggleSwitch label="Dangerous goods" checked={state.isDg} onChange={(v) => set({ isDg: v })} />
            <div className={`bf-special__reveal${state.isDg ? ' bf-special__reveal--open' : ''}`}>
              <div className="bf-special__inline">
                <FormField label="UN number">
                  <TextInput value={state.unNumber} onChange={(v) => set({ unNumber: v })} />
                </FormField>
                <FormField label="DG class">
                  <TextInput value={state.dgClass} onChange={(v) => set({ dgClass: v })} />
                </FormField>
              </div>
            </div>
          </div>

          <div className="bf-special__cell">
            <ToggleSwitch label="Temperature controlled" checked={state.isTempControlled} onChange={(v) => set({ isTempControlled: v })} />
            <div className={`bf-special__reveal${state.isTempControlled ? ' bf-special__reveal--open' : ''}`}>
              <FormField label="Temp range">
                <TextInput value={state.tempRange} onChange={(v) => set({ tempRange: v })} />
              </FormField>
            </div>
          </div>

          <div className="bf-special__cell">
            <ToggleSwitch label="Valuable cargo" checked={state.isValuable} onChange={(v) => set({ isValuable: v })} />
          </div>

          <div className="bf-special__cell">
            <ToggleSwitch label="Out of gauge" checked={state.isOog} onChange={(v) => set({ isOog: v })} />
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
