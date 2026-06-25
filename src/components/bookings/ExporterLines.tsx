import CustomerPicker from './CustomerPicker'
import { FormField, TextInput } from './bookingFormFields'
import type { BookingModule } from '../../types/booking'
import { MODULE_CONFIG } from '../../types/booking'

export type ExporterLineState = {
  id: string
  customer: { account_id: string; name: string } | null
  supplier_address: string
  pickup_location: string
  po_number: string
  commodity: string
  pieces: string
  weight_kg: string
  volume_m3: string
}

export function newExporterLine(): ExporterLineState {
  return {
    id: crypto.randomUUID(),
    customer: null,
    supplier_address: '',
    pickup_location: '',
    po_number: '',
    commodity: '',
    pieces: '',
    weight_kg: '',
    volume_m3: '',
  }
}

type Props = {
  module: BookingModule
  isConsolidation: boolean
  onConsolidationChange: (value: boolean) => void
  lines: ExporterLineState[]
  onChange: (lines: ExporterLineState[]) => void
}

export default function ExporterLines({
  module,
  isConsolidation,
  onConsolidationChange,
  lines,
  onChange,
}: Props) {
  const isSea = MODULE_CONFIG[module].mode === 'sea'

  function updateLine(id: string, patch: Partial<ExporterLineState>) {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  function toggleConsolidation(checked: boolean) {
    onConsolidationChange(checked)
    if (!checked && lines.length > 1) onChange([lines[0]])
  }

  return (
    <section className="booking-form__section">
      <h3>Exporter(s)</h3>
      <label className="booking-form__check">
        <input
          type="checkbox"
          checked={isConsolidation}
          onChange={(e) => toggleConsolidation(e.target.checked)}
        />
        Buyer&apos;s consolidation
      </label>

      <div className="exporter-lines">
        {lines.map((line, index) => (
          <div key={line.id} className="exporter-line card">
            <div className="exporter-line__head">
              <span className="exporter-line__title">Exporter {index + 1}</span>
              {isConsolidation && lines.length > 1 && (
                <button
                  type="button"
                  className="exporter-line__remove"
                  onClick={() => onChange(lines.filter((l) => l.id !== line.id))}
                >
                  Remove
                </button>
              )}
            </div>
            <CustomerPicker
              label="Exporter"
              required
              value={line.customer}
              onChange={(customer) => updateLine(line.id, { customer })}
            />
            <div className="booking-form__grid">
              <FormField label="Supplier address" full>
                <TextInput
                  value={line.supplier_address}
                  onChange={(v) => updateLine(line.id, { supplier_address: v })}
                />
              </FormField>
              <FormField label="Pickup location" full>
                <TextInput
                  value={line.pickup_location}
                  onChange={(v) => updateLine(line.id, { pickup_location: v })}
                />
              </FormField>
              <FormField label="PO number">
                <TextInput value={line.po_number} onChange={(v) => updateLine(line.id, { po_number: v })} />
              </FormField>
              <FormField label="Commodity">
                <TextInput value={line.commodity} onChange={(v) => updateLine(line.id, { commodity: v })} />
              </FormField>
              <FormField label="Pieces">
                <TextInput value={line.pieces} onChange={(v) => updateLine(line.id, { pieces: v })} />
              </FormField>
              <FormField label="Weight (kg)">
                <TextInput value={line.weight_kg} onChange={(v) => updateLine(line.id, { weight_kg: v })} />
              </FormField>
              {isSea && (
                <FormField label="Volume (m³)">
                  <TextInput value={line.volume_m3} onChange={(v) => updateLine(line.id, { volume_m3: v })} />
                </FormField>
              )}
            </div>
          </div>
        ))}
      </div>

      {isConsolidation && (
        <button
          type="button"
          className="booking-form__add"
          onClick={() => onChange([...lines, newExporterLine()])}
        >
          + Add exporter
        </button>
      )}
    </section>
  )
}
