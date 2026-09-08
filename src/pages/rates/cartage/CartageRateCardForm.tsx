import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCurrencies } from '../../../hooks/useQuoteRefData'
import DateField from '../../../components/DateField'
import VendorSelect, { type VendorValue } from '../VendorSelect'
import { createCartageRateCard } from './cartageRatesApi'

export default function CartageRateCardForm() {
  const navigate = useNavigate()
  const { items: currencies } = useCurrencies()

  const [vendor, setVendor] = useState<VendorValue>(null)
  const [title, setTitle] = useState('')
  const [currency, setCurrency] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const datesOk = validFrom !== '' && validTo !== '' && validFrom <= validTo
  const valid = vendor !== null && currency !== '' && datesOk

  async function onSubmit() {
    if (!valid || saving) return
    setSaving(true)
    setError('')
    try {
      await createCartageRateCard({
        vendor_account_id: vendor?.account_id ?? '',
        vendor_name: vendor?.name ?? '',
        title: title.trim(),
        currency_code: currency,
        valid_from: validFrom,
        valid_to: validTo,
      })
      navigate('/setup/rates/cartage')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create rate card')
      setSaving(false)
    }
  }

  const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
  const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates/cartage" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Domestic Cartage
          </Link>
          <h1>New cartage rate card</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Create the card header. You'll add FCL lines, LTL lanes, and surcharges next.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16, maxWidth: 720 }}>
          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Vendor *</label>
            <VendorSelect value={vendor} onChange={setVendor} placeholder="Search customer / contact…" />
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Cartage cards must be linked to a vendor account.</span>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Currency *</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="">Select currency…</option>
              {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code} — {c.name}</option>))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Metro cartage 2026" />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Valid from *</label>
            <DateField value={validFrom || null} onChange={setValidFrom} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Valid to *</label>
            <DateField value={validTo || null} onChange={setValidTo} />
          </div>
        </div>

        {validFrom !== '' && validTo !== '' && validFrom > validTo && (
          <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>Valid-to must be on or after valid-from.</p>
        )}
        {error && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
          <button type="button" className="btn btn--inline" onClick={onSubmit} disabled={!valid || saving} style={{ marginTop: 0, opacity: !valid || saving ? 0.5 : 1 }}>
            {saving ? 'Creating…' : 'Create rate card'}
          </button>
          <Link to="/setup/rates/cartage" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', fontSize: 14, color: 'var(--muted-foreground)', textDecoration: 'none' }}>Cancel</Link>
        </div>
      </div>
    </div>
  )
}
