import { SectionCard, FormField, type SectionProps } from '../formUi'

export default function NotesSection({ state, set }: SectionProps) {
  return (
    <SectionCard id="notes" title="Notes">
      <FormField label="Special instructions" full>
        <textarea
          className="bf-textarea bf-textarea--compact"
          rows={4}
          value={state.specialInstructions}
          onChange={(e) => set({ specialInstructions: e.target.value })}
          placeholder="Internal notes, handling instructions…"
        />
      </FormField>
    </SectionCard>
  )
}
