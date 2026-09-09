import { useState, type ReactNode } from 'react'
import { Contact } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CourierPartyPicker, { type CourierPartyPick } from './CourierPartyPicker'
import { partyPickToAddress, type CourierAddressParty } from './courierBookingTypes'

type Props = {
  title: string
  value: CourierAddressParty
  onChange: (v: CourierAddressParty) => void
  defaultResidential?: boolean
}

function Field({ label, children, span2 }: { label: string; children: ReactNode; span2?: boolean }) {
  return (
    <label className={`cbf-field${span2 ? ' cbf-field--span2' : ''}`}>
      <span className="cbf-label">{label}</span>
      {children}
    </label>
  )
}

export default function CourierBookingAddressBlock({ title, value, onChange, defaultResidential }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  function patch(p: Partial<CourierAddressParty>) {
    onChange({ ...value, ...p })
  }

  function fillFromParty(p: CourierPartyPick) {
    onChange(partyPickToAddress(p, defaultResidential ?? value.residential))
    setPickerOpen(false)
  }

  return (
    <div className="cbf-block">
      <div className="cbf-block-head">
        <h4>{title}</h4>
        <Button type="button" variant="ghost" size="icon-sm" title="Fill from customer or agent" aria-label="Fill from customer or agent"
          onClick={() => setPickerOpen((v) => !v)}>
          <Contact size={16} />
        </Button>
      </div>
      {pickerOpen && (
        <CourierPartyPicker label={`Fill ${title.toLowerCase()}`} onPick={fillFromParty} />
      )}
      <div className="cbf-fields">
        <Field label="Full name">
          <input className="cbf-input" value={value.fullName} onChange={(e) => patch({ fullName: e.target.value })} />
        </Field>
        <Field label="Company">
          <input className="cbf-input" value={value.company} onChange={(e) => patch({ company: e.target.value })} />
        </Field>
        <label className="cbf-check cbf-field--span2">
          <input type="checkbox" checked={value.businessContact} onChange={(e) => patch({ businessContact: e.target.checked })} />
          Business contact
        </label>
        <Field label="Country">
          <input className="cbf-input" value={value.countryCode} onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })} maxLength={2} />
        </Field>
        <Field label="Postcode">
          <input className="cbf-input" value={value.postcode} onChange={(e) => patch({ postcode: e.target.value })} />
        </Field>
        <Field label="Address 1" span2>
          <input className="cbf-input" value={value.address1} onChange={(e) => patch({ address1: e.target.value })} />
        </Field>
        <Field label="Address 2" span2>
          <input className="cbf-input" value={value.address2} onChange={(e) => patch({ address2: e.target.value })} />
        </Field>
        <Field label="Address 3" span2>
          <input className="cbf-input" value={value.address3} onChange={(e) => patch({ address3: e.target.value })} />
        </Field>
        <Field label="City">
          <input className="cbf-input" value={value.city} onChange={(e) => patch({ city: e.target.value })} />
        </Field>
        <Field label="State">
          <input className="cbf-input" value={value.state} onChange={(e) => patch({ state: e.target.value })} />
        </Field>
        <label className="cbf-check">
          <input type="checkbox" checked={value.residential} onChange={(e) => patch({ residential: e.target.checked })} />
          Residential
        </label>
        <Field label="Email">
          <input className="cbf-input" type="email" value={value.email} onChange={(e) => patch({ email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className="cbf-input" value={value.phone} onChange={(e) => patch({ phone: e.target.value })} />
        </Field>
        <Field label="VAT / Tax ID" span2>
          <input className="cbf-input" value={value.vatTaxId} onChange={(e) => patch({ vatTaxId: e.target.value })} />
        </Field>
      </div>
    </div>
  )
}
