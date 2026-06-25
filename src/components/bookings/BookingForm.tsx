import { useState } from 'react'
import SlideDrawer from '../SlideDrawer'
import CustomerPicker from './CustomerPicker'
import ExporterLines, { newExporterLine } from './ExporterLines'
import { FormField, FormSection, TextInput } from './bookingFormFields'
import {
  buildBookingPayload,
  buildExporterRows,
  validateBookingForm,
  type PayerChoice,
} from './bookingFormUtils'
import { createBooking } from '../../hooks/useBookings'
import type { BookingModule } from '../../types/booking'
import { MODULE_CONFIG } from '../../types/booking'
import './bookingForm.css'

type Props = {
  module: BookingModule
  onClose: () => void
  onSaved: () => void
}

export default function BookingForm({ module, onClose, onSaved }: Props) {
  const cfg = MODULE_CONFIG[module]
  const isSea = cfg.mode === 'sea'
  const isAir = cfg.mode === 'air'

  const [importerCustomer, setImporterCustomer] = useState<{ account_id: string; name: string } | null>(null)
  const [importerNameOverride, setImporterNameOverride] = useState('')
  const [isConsolidation, setIsConsolidation] = useState(false)
  const [exporters, setExporters] = useState([newExporterLine()])
  const [payer, setPayer] = useState<PayerChoice>('importer')
  const [payerOther, setPayerOther] = useState<{ account_id: string; name: string } | null>(null)
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [incoterm, setIncoterm] = useState('')
  const [commodity, setCommodity] = useState('')
  const [pieces, setPieces] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [volumeM3, setVolumeM3] = useState('')
  const [chargeableWeightKg, setChargeableWeightKg] = useState('')
  const [containerType, setContainerType] = useState('')
  const [containerCount, setContainerCount] = useState('')
  const [vesselFlight, setVesselFlight] = useState('')
  const [etd, setEtd] = useState('')
  const [eta, setEta] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')

  async function save() {
    setError('')
    setWarn('')

    const state = {
      module,
      importerCustomer,
      importerNameOverride,
      isConsolidation,
      exporters,
      payer,
      payerOther,
      origin,
      destination,
      incoterm,
      commodity,
      pieces,
      weight_kg: weightKg,
      volume_m3: volumeM3,
      chargeable_weight_kg: chargeableWeightKg,
      container_type: containerType,
      container_count: containerCount,
      vessel_flight: vesselFlight,
      etd,
      eta,
      special_instructions: specialInstructions,
    }

    const { blocking, warnings } = validateBookingForm(state)
    if (blocking) {
      setError(blocking)
      return
    }
    if (warnings.length) setWarn(warnings.join(' '))

    setSaving(true)
    try {
      await createBooking(buildBookingPayload(state), buildExporterRows(exporters))
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SlideDrawer
      open
      wide
      onClose={onClose}
      ariaLabel={`New ${cfg.label} booking`}
      footer={
        <div className="booking-form__footer-actions">
          <button type="button" className="btn booking-form__cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="bookings-page__new" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Create booking'}
          </button>
        </div>
      }
    >
      <h2 className="booking-form__title">New {cfg.label} Booking</h2>
      {error && <div className="error card pad-inline">{error}</div>}
      {warn && <div className="booking-form__warn">{warn}</div>}

      <FormSection title="Importer">
        <CustomerPicker label="Importer" required value={importerCustomer} onChange={setImporterCustomer} />
        <FormField label="Importer name override">
          <TextInput
            value={importerNameOverride}
            placeholder="Optional display name override"
            onChange={setImporterNameOverride}
          />
        </FormField>
      </FormSection>

      <ExporterLines
        module={module}
        isConsolidation={isConsolidation}
        onConsolidationChange={setIsConsolidation}
        lines={exporters}
        onChange={setExporters}
      />

      <FormSection title="Payer">
        <div className="booking-form__radios">
          {(['importer', 'exporter', 'other'] as const).map((choice) => (
            <label key={choice} className="booking-form__radio">
              <input type="radio" name="payer" checked={payer === choice} onChange={() => setPayer(choice)} />
              {choice === 'importer' ? 'Importer' : choice === 'exporter' ? 'Exporter' : 'Other'}
            </label>
          ))}
        </div>
        {payer === 'other' && (
          <CustomerPicker label="Payer account" required value={payerOther} onChange={setPayerOther} />
        )}
      </FormSection>

      <FormSection title="Route & cargo">
        <div className="booking-form__grid">
          <FormField label={`Origin (${cfg.portKind})`}>
            <TextInput value={origin} onChange={setOrigin} />
          </FormField>
          <FormField label={`Destination (${cfg.portKind})`}>
            <TextInput value={destination} onChange={setDestination} />
          </FormField>
          <FormField label="Incoterm"><TextInput value={incoterm} onChange={setIncoterm} /></FormField>
          <FormField label="Commodity"><TextInput value={commodity} onChange={setCommodity} /></FormField>
          <FormField label="Pieces"><TextInput value={pieces} onChange={setPieces} /></FormField>
          <FormField label="Weight (kg)"><TextInput value={weightKg} onChange={setWeightKg} /></FormField>
          {isSea && (
            <>
              <FormField label="Volume (m³)"><TextInput value={volumeM3} onChange={setVolumeM3} /></FormField>
              <FormField label="Container type"><TextInput value={containerType} onChange={setContainerType} /></FormField>
              <FormField label="Container count"><TextInput value={containerCount} onChange={setContainerCount} /></FormField>
            </>
          )}
          {isAir && (
            <FormField label="Chargeable weight (kg)">
              <TextInput value={chargeableWeightKg} onChange={setChargeableWeightKg} />
            </FormField>
          )}
          <FormField label={isSea ? 'Vessel' : 'Flight'}>
            <TextInput value={vesselFlight} onChange={setVesselFlight} />
          </FormField>
          <FormField label="ETD"><input className="input input--sm" type="date" value={etd} onChange={(e) => setEtd(e.target.value)} /></FormField>
          <FormField label="ETA"><input className="input input--sm" type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></FormField>
        </div>
      </FormSection>

      <FormSection title="Notes">
        <textarea
          className="booking-form__textarea"
          rows={4}
          placeholder="Special instructions…"
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
        />
      </FormSection>
    </SlideDrawer>
  )
}
