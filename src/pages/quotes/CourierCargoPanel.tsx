import { useState } from 'react'
import { Button } from '@/components/ui/button'
import AddressAutocomplete from '../../components/bookings/AddressAutocomplete'
import CourierPieceRows from './CourierPieceRows'
import CourierCourierSelector, { type CourierCourierOption } from './CourierCourierSelector'
import CourierBookingForm from './CourierBookingForm'
import { runDhlCourier, runFedexCourier, type DhlCourierSearchBody } from './courierSearchApi'
import './airCargoPanel.css'
import './quoteCargoEntry.css'

export type CourierLocation = {
  countryCode: string
  city: string
  postcode: string
}

export type CourierDestination = CourierLocation & {
  residential: boolean
}

export type CourierPiece = {
  id: string
  qty: string
  weightKg: string
  lengthCm: string
  widthCm: string
  heightCm: string
}

export function newCourierPiece(): CourierPiece {
  return { id: crypto.randomUUID(), qty: '', weightKg: '', lengthCm: '', widthCm: '', heightCm: '' }
}

export type CourierCargoPanelProps = {
  isDocuments: boolean
  onIsDocumentsChange: (v: boolean) => void
  fromAddress: string
  from: CourierLocation
  onFromChange: (address: string, fields: Partial<CourierLocation>) => void
  toAddress: string
  to: CourierDestination
  onToChange: (address: string, fields: Partial<CourierLocation>) => void
  onToResidentialChange: (v: boolean) => void
  pieces: CourierPiece[]
  onPiecesChange: (pieces: CourierPiece[]) => void
  onAddPiece: () => void
  quoteId?: string | null
  incoterm?: string | null
}

function toSearchPieces(pieces: CourierPiece[]) {
  return pieces.map((p) => ({
    qty: Number(p.qty) || 0,
    weightKg: Number(p.weightKg) || 0,
    lengthCm: Number(p.lengthCm) || 0,
    widthCm: Number(p.widthCm) || 0,
    heightCm: Number(p.heightCm) || 0,
  }))
}

type AnyOption = {
  carrier?: string
  service?: string
  product?: string
  productCode?: string
  charge?: number
  total?: number
  amount?: number
  currency?: string
  eta?: string
  transitDays?: number
}

function toSelectorOption(o: AnyOption, fallbackCarrier: string): CourierCourierOption {
  return {
    carrier: o.carrier ?? fallbackCarrier,
    service: o.service ?? o.product ?? o.productCode ?? 'Courier',
    serviceCode: o.productCode,
    charge: o.charge ?? o.total ?? o.amount ?? 0,
    currency: o.currency,
    eta: o.eta ?? (o.transitDays != null ? `${o.transitDays} days` : undefined),
  }
}

export default function CourierCargoPanel({
  isDocuments,
  onIsDocumentsChange,
  fromAddress,
  from,
  onFromChange,
  toAddress,
  to,
  onToChange,
  onToResidentialChange,
  pieces,
  onPiecesChange,
  onAddPiece,
  quoteId,
  incoterm,
}: CourierCargoPanelProps) {
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [courierOptions, setCourierOptions] = useState<CourierCourierOption[]>([])
  const [selectedCourier, setSelectedCourier] = useState(0)
  const [bookOpen, setBookOpen] = useState(false)

  const [capFrom, setCapFrom] = useState<CourierLocation>(from)
  const [capTo, setCapTo] = useState<CourierLocation>(to)

  function handleFrom(address: string, c?: Partial<CourierLocation> & { state?: string }) {
    if (c && (c.countryCode || c.city || c.postcode || c.state)) {
      const next = { countryCode: c.countryCode ?? '', city: (c.city || c.state) ?? '', postcode: c.postcode ?? '' }
      setCapFrom(next)
      onFromChange(address, next)
    } else {
      onFromChange(address, {})
    }
  }

  function handleTo(address: string, c?: Partial<CourierLocation> & { state?: string }) {
    if (c && (c.countryCode || c.city || c.postcode || c.state)) {
      const next = { countryCode: c.countryCode ?? '', city: (c.city || c.state) ?? '', postcode: c.postcode ?? '' }
      setCapTo(next)
      onToChange(address, next)
    } else {
      onToChange(address, {})
    }
  }

  async function searchRates() {
    setSearching(true)
    setSearchError(null)
    setCourierOptions([])
    setSelectedCourier(0)
    const f = capFrom.countryCode ? capFrom : from
    const t = capTo.countryCode ? capTo : to
    const body: DhlCourierSearchBody = {
      origin: { countryCode: f.countryCode, city: f.city, postcode: f.postcode },
      destination: { countryCode: t.countryCode, city: t.city, postcode: t.postcode, residential: to.residential },
      isDocuments,
      pieces: toSearchPieces(pieces),
    }
    try {
      const [dhl, fedex] = await Promise.allSettled([runDhlCourier(body), runFedexCourier(body)])
      const merged: CourierCourierOption[] = []
      const errors: string[] = []

      if (dhl.status === 'fulfilled' && dhl.value.ok) {
        const raw = dhl.value.options?.length ? dhl.value.options : dhl.value.best ? [dhl.value.best] : []
        merged.push(...raw.map((o: AnyOption) => toSelectorOption(o, 'DHL')))
      } else if (dhl.status === 'fulfilled' && !dhl.value.ok) {
        errors.push(`DHL: ${[dhl.value.reason, dhl.value.detail].filter(Boolean).join(' - ')}`)
      }

      if (fedex.status === 'fulfilled' && fedex.value.ok) {
        const raw = fedex.value.options?.length ? fedex.value.options : fedex.value.best ? [fedex.value.best] : []
        merged.push(...raw.map((o: AnyOption) => toSelectorOption(o, 'FedEx')))
      } else if (fedex.status === 'fulfilled' && !fedex.value.ok) {
        errors.push(`FedEx: ${[fedex.value.reason, fedex.value.detail].filter(Boolean).join(' - ')}`)
      }

      merged.sort((a, b) => a.charge - b.charge)
      setCourierOptions(merged)
      if (merged.length === 0) setSearchError(errors.join(' | ') || 'No rates returned')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="acp">
      <div className="qce__toggle" role="tablist" aria-label="Shipment type">
        <button
          type="button"
          role="tab"
          aria-selected={isDocuments}
          className={`qce__toggle-btn${isDocuments ? ' qce__toggle-btn--on' : ''}`}
          onClick={() => onIsDocumentsChange(true)}
        >
          Documents
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isDocuments}
          className={`qce__toggle-btn${!isDocuments ? ' qce__toggle-btn--on' : ''}`}
          onClick={() => onIsDocumentsChange(false)}
        >
          Packages
        </button>
      </div>

      <div className="acp__addrs">
        <label className="acp__field">
          <span className="acp__label">Origin</span>
          <AddressAutocomplete label="" value={fromAddress} usePlaces onChange={(address, c) => handleFrom(address, c)} />
        </label>

        <div className="acp__field">
          <span className="acp__label">Destination</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <AddressAutocomplete label="" value={toAddress} usePlaces onChange={(address, c) => handleTo(address, c)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingBottom: 8 }}>
              <input type="checkbox" checked={to.residential} onChange={(e) => onToResidentialChange(e.target.checked)} />
              <span className="acp__label" style={{ margin: 0 }}>Residential</span>
            </label>
          </div>
        </div>
      </div>

      {!isDocuments && (
        <CourierPieceRows pieces={pieces} onChange={onPiecesChange} onAddPiece={onAddPiece} />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--inline" style={{ marginTop: 0, whiteSpace: 'nowrap' }} onClick={() => void searchRates()} disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchError && (
        <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>{searchError}</p>
      )}

      {courierOptions.length > 0 && (
        <>
          <CourierCourierSelector options={courierOptions} value={selectedCourier} onChange={setSelectedCourier} />
          {courierOptions[selectedCourier]?.carrier.toUpperCase() === 'DHL' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setBookOpen(true)}>Book</Button>
            </div>
          )}
        </>
      )}

      {bookOpen && courierOptions[selectedCourier] && (
        <CourierBookingForm
          open={bookOpen}
          onOpenChange={setBookOpen}
          quoteId={quoteId}
          selectedRate={courierOptions[selectedCourier]}
          prefill={{
            isDocuments,
            fromAddress,
            from: capFrom.countryCode ? capFrom : from,
            toAddress,
            to,
            pieces,
            incoterm,
          }}
        />
      )}
    </div>
  )
}
