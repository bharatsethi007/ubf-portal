import PartyCard from '../../../components/bookings/PartyCard'
import { applyConsigneeCustomer } from '../bookingFormState'
import { SectionCard, type SectionProps } from '../formUi'

export default function ConsigneeSection({ state, set, errors = {}, showErrors }: SectionProps) {
  return (
    <SectionCard id="consignee" bare>
      <PartyCard
        role="Consignee"
        required
        error={errors.consigneeCustomer}
        showError={showErrors}
        values={{
          customer: state.consigneeCustomer,
          contact: state.consigneeContact,
          phone: state.consigneePhone,
          email: state.consigneeEmail,
          address: state.consigneeAddress,
          city: state.consigneeCity,
          state: state.consigneeState,
          postcode: state.consigneePostcode,
          country: state.consigneeCountry,
        }}
        onCustomerChange={(c) => set(applyConsigneeCustomer(c))}
        onChange={(p) => set({
          ...(p.contact !== undefined && { consigneeContact: p.contact }),
          ...(p.phone !== undefined && { consigneePhone: p.phone }),
          ...(p.email !== undefined && { consigneeEmail: p.email }),
          ...(p.address !== undefined && { consigneeAddress: p.address }),
          ...(p.city !== undefined && { consigneeCity: p.city }),
          ...(p.state !== undefined && { consigneeState: p.state }),
          ...(p.postcode !== undefined && { consigneePostcode: p.postcode }),
          ...(p.country !== undefined && { consigneeCountry: p.country }),
        })}
      />
    </SectionCard>
  )
}
