import PlaceInput from './PlaceInput'
import { withPlace, type Party } from './contactsApi'

type Props = { id: string; value: Party; onChange: (p: Party) => void; companyLabel?: string }

/** Company, person, email, phone and a Google-backed address. */
export default function PartyFields({ id, value: p, onChange, companyLabel = 'Company' }: Props) {
  const set = <K extends keyof Party>(k: K, v: Party[K]) => onChange({ ...p, [k]: v })
  return (
    <>
      <div className="pv3-form__grid">
        <div className="pv3-field"><label htmlFor={`${id}-co`}>{companyLabel}</label>
          <input id={`${id}-co`} value={p.company} onChange={(e) => set('company', e.target.value)} placeholder="Company name" />
        </div>
        <div className="pv3-field"><label htmlFor={`${id}-cn`}>Contact person</label>
          <input id={`${id}-cn`} value={p.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Name" />
        </div>
        <div className="pv3-field"><label htmlFor={`${id}-em`}>Email</label>
          <input id={`${id}-em`} type="email" value={p.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" />
        </div>
        <div className="pv3-field"><label htmlFor={`${id}-ph`}>Phone</label>
          <input id={`${id}-ph`} type="tel" value={p.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+86 21 5555 0000" />
        </div>
      </div>
      <PlaceInput id={`${id}-ad`} label="Address" value={p.address}
        onText={(t) => onChange({ ...p, address: t, place_id: '', lat: null, lng: null })}
        onPick={(g) => onChange(withPlace(p, g))} />
      <div className="pv3-form__grid">
        <div className="pv3-field"><label htmlFor={`${id}-ci`}>City</label>
          <input id={`${id}-ci`} value={p.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="pv3-field"><label htmlFor={`${id}-pc`}>Postcode</label>
          <input id={`${id}-pc`} value={p.postcode} onChange={(e) => set('postcode', e.target.value)} />
        </div>
        <div className="pv3-field"><label htmlFor={`${id}-cc`}>Country</label>
          <input id={`${id}-cc`} value={p.country} onChange={(e) => onChange({ ...p, country: e.target.value, country_code: '' })} placeholder="e.g. China" />
        </div>
      </div>
    </>
  )
}
