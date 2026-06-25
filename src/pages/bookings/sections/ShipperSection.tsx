import PartyCard from '../../../components/bookings/PartyCard'
import CustomerPicker from '../../../components/bookings/CustomerPicker'
import type { SupplierRowState } from '../bookingFormState'
import { applyShipperCustomer, applySupplierCustomer, newSupplierRow } from '../bookingFormState'
import { SectionCard, FormField, TextInput, ToggleSwitch, type SectionProps } from '../formUi'

type Props = SectionProps & {
  setSuppliers: (rows: SupplierRowState[]) => void
}

function SupplierRow({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: SupplierRowState
  index: number
  onChange: (patch: Partial<SupplierRowState>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="exporter-line">
      <div className="exporter-line__head">
        <span className="exporter-line__title">Supplier {index + 1}</span>
        {canRemove && (
          <button type="button" className="exporter-line__remove" onClick={onRemove}>Remove</button>
        )}
      </div>
      <CustomerPicker label="Supplier" value={row.customer} onChange={(c) => onChange(applySupplierCustomer(c))} />
      <div className="bf-grid bf-grid--tight">
        <FormField label="Company name" full>
          <TextInput value={row.companyName} onChange={(v) => onChange({ companyName: v })} />
        </FormField>
        <FormField label="Address" full>
          <TextInput value={row.address} onChange={(v) => onChange({ address: v })} />
        </FormField>
        <FormField label="City"><TextInput value={row.city} onChange={(v) => onChange({ city: v })} /></FormField>
        <FormField label="Country"><TextInput value={row.country} onChange={(v) => onChange({ country: v })} /></FormField>
        <FormField label="Pieces"><TextInput value={row.pieces} onChange={(v) => onChange({ pieces: v })} /></FormField>
        <FormField label="Weight kg"><TextInput value={row.weight} onChange={(v) => onChange({ weight: v })} /></FormField>
        <FormField label="CBM"><TextInput value={row.cbm} onChange={(v) => onChange({ cbm: v })} /></FormField>
        <FormField label="Goods description" full>
          <TextInput value={row.goodsDescription} onChange={(v) => onChange({ goodsDescription: v })} />
        </FormField>
      </div>
    </div>
  )
}

export default function ShipperSection({
  state,
  set,
  setSuppliers,
  errors = {},
  showErrors,
}: Props) {
  function updateSupplier(id: string, patch: Partial<SupplierRowState>) {
    setSuppliers(state.suppliers.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const consolidationToggle = (
    <ToggleSwitch
      label="Is Consolidation?"
      checked={state.isConsolidation}
      onChange={(on) => set({ isConsolidation: on, suppliers: on ? state.suppliers : [newSupplierRow()] })}
    />
  )

  return (
    <SectionCard id="shipper" bare>
      {state.isConsolidation && (
        <div className="party-card__header-slot">{consolidationToggle}</div>
      )}

      {state.isConsolidation ? (
        <>
          <p className="bf-hint">Multiple suppliers</p>
          <div className="exporter-lines">
            {state.suppliers.map((row, i) => (
              <SupplierRow
                key={row.id}
                row={row}
                index={i}
                canRemove={state.suppliers.length > 1}
                onChange={(patch) => updateSupplier(row.id, patch)}
                onRemove={() => setSuppliers(state.suppliers.filter((r) => r.id !== row.id))}
              />
            ))}
          </div>
          <button type="button" className="bf-add" onClick={() => setSuppliers([...state.suppliers, newSupplierRow()])}>
            + Add Supplier
          </button>
          {showErrors && errors.shipperCustomer && (
            <p className="bf-field__error">{errors.shipperCustomer}</p>
          )}
        </>
      ) : (
        <PartyCard
          role="Shipper"
          required
          headerSlot={consolidationToggle}
          error={errors.shipperCustomer}
          showError={showErrors}
          values={{
            customer: state.shipperCustomer,
            contact: state.shipperContact,
            phone: state.shipperPhone,
            email: state.shipperEmail,
            address: state.shipperAddress,
            city: state.shipperCity,
            state: state.shipperState,
            postcode: state.shipperPostcode,
            country: state.shipperCountry,
          }}
          onCustomerChange={(c) => set(applyShipperCustomer(c))}
          onChange={(p) => set({
            ...(p.contact !== undefined && { shipperContact: p.contact }),
            ...(p.phone !== undefined && { shipperPhone: p.phone }),
            ...(p.email !== undefined && { shipperEmail: p.email }),
            ...(p.address !== undefined && { shipperAddress: p.address }),
            ...(p.city !== undefined && { shipperCity: p.city }),
            ...(p.state !== undefined && { shipperState: p.state }),
            ...(p.postcode !== undefined && { shipperPostcode: p.postcode }),
            ...(p.country !== undefined && { shipperCountry: p.country }),
          })}
        />
      )}
    </SectionCard>
  )
}
