import { SectionCard, FormField, TextInput, type SectionProps } from '../formUi'

export default function NotifySection({ state, set }: SectionProps) {
  return (
    <SectionCard id="notify" title="Notify party">
      <div className="bf-grid bf-grid--tight">
        <FormField label="Notify name"><TextInput value={state.notifyName} onChange={(v) => set({ notifyName: v })} /></FormField>
        <FormField label="Notify country"><TextInput value={state.notifyCountry} onChange={(v) => set({ notifyCountry: v })} /></FormField>
        <FormField label="Notify address" full>
          <TextInput value={state.notifyAddress} onChange={(v) => set({ notifyAddress: v })} />
        </FormField>
      </div>
    </SectionCard>
  )
}
