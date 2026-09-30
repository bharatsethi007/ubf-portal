import { useEffect } from 'react'
import PlaceInput from '../contacts/PlaceInput'
import type { Contact } from '../contacts/contactsApi'
import PartyPicker from './PartyPicker'
import { doorDeliveryTerms, originPickupTerms, type BookingDraft } from './bookingModel'

type Set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => void
type Props = { f: BookingDraft; set: Set; contacts: Contact[] }

const CURRENCIES = ['NZD', 'USD', 'AUD', 'EUR', 'CNY', 'GBP', 'JPY', 'FJD']

/** Shipper and consignee, collection and delivery, customs and insurance, references. */
export default function BookingPartiesServices({ f, set, contacts }: Props) {
  const imp = f.direction === 'import'

  // Terms that put collection or door delivery in our hands switch those on, prefilled from the party.
  useEffect(() => {
    if (imp && originPickupTerms.has(f.incoterm) && !f.pickup) {
      set('pickup', true)
      if (!f.pickup_address) set('pickup_address', f.shipper.address)
    }
    if (!imp && doorDeliveryTerms.has(f.incoterm) && !f.delivery) {
      set('delivery', true)
      if (!f.delivery_address) set('delivery_address', f.consignee.address)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.incoterm, imp])

  const pickupLabel = imp ? 'Collect from the shipper at origin' : 'Collect from us in New Zealand'
  const deliveryLabel = imp ? 'Deliver to our door in New Zealand' : 'Deliver to the consignee’s door'

  return (
    <>
      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.15s' }}>
        <h2>Shipper and consignee</h2>
        <PartyPicker id="bk-shp" role="shipper" title="Shipper" required={imp}
          hint={imp ? 'Your supplier, who sends the goods.' : 'Leave blank if it is you.'}
          value={f.shipper} onChange={(p) => set('shipper', p)} contacts={contacts} save={f.save_shipper} onSave={(v) => set('save_shipper', v)} />
        <hr style={{ border: 0, borderTop: '1px solid var(--line-soft)', margin: '2px 0' }} />
        <PartyPicker id="bk-cne" role="consignee" title="Consignee" required={!imp}
          hint={imp ? 'Leave blank if it is you.' : 'Your customer, who receives the goods.'}
          value={f.consignee} onChange={(p) => set('consignee', p)} contacts={contacts} save={f.save_consignee} onSave={(v) => set('save_consignee', v)} />
      </section>

      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.2s' }}>
        <h2>Services</h2>
        <label className="pv3-check">
          <input type="checkbox" checked={f.pickup} onChange={(e) => { set('pickup', e.target.checked); if (e.target.checked && !f.pickup_address) set('pickup_address', imp ? f.shipper.address : '') }} /> {pickupLabel}
        </label>
        {f.pickup && (
          <PlaceInput id="bk-pu" label="Pickup address" value={f.pickup_address} onText={(t) => set('pickup_address', t)} onPick={(g) => set('pickup_address', g.address)} />
        )}
        <label className="pv3-check">
          <input type="checkbox" checked={f.delivery} onChange={(e) => { set('delivery', e.target.checked); if (e.target.checked && !f.delivery_address) set('delivery_address', imp ? '' : f.consignee.address) }} /> {deliveryLabel}
        </label>
        {f.delivery && (
          <PlaceInput id="bk-de" label="Delivery address" value={f.delivery_address} onText={(t) => set('delivery_address', t)} onPick={(g) => set('delivery_address', g.address)} />
        )}
        <label className="pv3-check">
          <input type="checkbox" checked={f.needs_customs} onChange={(e) => set('needs_customs', e.target.checked)} />
          {imp ? 'Clear NZ customs and MPI for us' : 'Lodge the NZ export entry for us'}
        </label>
        <label className="pv3-check">
          <input type="checkbox" checked={f.needs_insurance} onChange={(e) => set('needs_insurance', e.target.checked)} /> Insure the cargo
        </label>
        {f.needs_insurance && (
          <div className="pv3-form__grid">
            <div className="pv3-field"><label htmlFor="bk-val">Cargo value</label>
              <input id="bk-val" type="number" min={0} value={f.cargo_value} onChange={(e) => set('cargo_value', e.target.value)} placeholder="Commercial invoice value" />
            </div>
            <div className="pv3-field"><label htmlFor="bk-valc">Currency</label>
              <select id="bk-valc" value={f.cargo_value_currency} onChange={(e) => set('cargo_value_currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.25s' }}>
        <h2>References</h2>
        <div className="pv3-form__grid">
          <div className="pv3-field"><label htmlFor="bk-po">Your PO / reference</label>
            <input id="bk-po" value={f.customer_ref} onChange={(e) => set('customer_ref', e.target.value)} placeholder="Shows on your shipment" />
          </div>
        </div>
        <div className="pv3-field pv3-field--wide"><label htmlFor="bk-notes">Anything else we should know?</label>
          <textarea id="bk-notes" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Deadlines, opening hours, special handling" />
        </div>
      </section>
    </>
  )
}
