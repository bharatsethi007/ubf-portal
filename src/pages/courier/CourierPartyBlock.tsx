type PartyFields = {
  name: string | null
  company: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  city: string | null
  state: string | null
  postcode: string | null
  country: string | null
  phone: string | null
  email: string | null
}

function line(value: string | null | undefined): string {
  return value?.trim() || '—'
}

function cityStatePostcode(p: PartyFields): string {
  const cityState = [p.city?.trim(), p.state?.trim()].filter(Boolean).join(', ')
  const parts = [cityState, p.postcode?.trim()].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

export default function CourierPartyBlock({ title, party }: { title: string; party: PartyFields }) {
  return (
    <section className="card booking-form-card cbd-party">
      <h3 className="booking-form-card__title">{title}</h3>
      <div className="booking-form-card__body cbd-party__body">
        <div className="cbd-field">
          <span className="cbd-field__label">Name</span>
          <span className="cbd-field__value">{line(party.name)}</span>
        </div>
        <div className="cbd-field">
          <span className="cbd-field__label">Company</span>
          <span className="cbd-field__value">{line(party.company)}</span>
        </div>
        <div className="cbd-field">
          <span className="cbd-field__label">Address</span>
          <span className="cbd-field__value cbd-field__value--stack">
            <span>{line(party.address1)}</span>
            {party.address2?.trim() ? <span>{party.address2}</span> : null}
            {party.address3?.trim() ? <span>{party.address3}</span> : null}
          </span>
        </div>
        <div className="cbd-field">
          <span className="cbd-field__label">City / State / Postcode</span>
          <span className="cbd-field__value">{cityStatePostcode(party)}</span>
        </div>
        <div className="cbd-field">
          <span className="cbd-field__label">Country</span>
          <span className="cbd-field__value">{line(party.country)}</span>
        </div>
        <div className="cbd-field">
          <span className="cbd-field__label">Phone</span>
          <span className="cbd-field__value">{line(party.phone)}</span>
        </div>
        <div className="cbd-field">
          <span className="cbd-field__label">Email</span>
          <span className="cbd-field__value">{line(party.email)}</span>
        </div>
      </div>
    </section>
  )
}
