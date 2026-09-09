import { useState } from 'react'
import AddressAutocomplete from '../../components/bookings/AddressAutocomplete'
import CourierPieceRows from './CourierPieceRows'
import CourierCourierSelector, { type CourierCourierOption } from './CourierCourierSelector'
import { runDhlCourier, type DhlCourierOption, type DhlCourierSearchBody } from './courierSearchApi'
import './airCargoPanel.css'
import './quoteCargoEntry.css'

export type CourierLocation = {
  countryCode: string
  city: string
  state?: string
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

function dhlToSelectorOption(o: DhlCourierOption): CourierCourierOption {
  return {
    carrier: 'DHL',
    service: o.service ?? o.product ?? o.productCode ?? 'Courier',
    charge: o.charge ?? o.total ?? o.amount ?? 0,
    eta: (o as { eta?: string }).eta ?? (o.transitDays != null ? `${o.transitDays} days` : undefined),
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
}: CourierCargoPanelProps) {
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [courierOptions, setCourierOptions] = useState<CourierCourierOption[]>([])
  const [selectedCourier, setSelectedCourier] = useState(0)

  // Locally captured location fields from the last real place selection.
  // Google only supplies components on place_changed; blur/typing re-fires
  // onChange with no components, so we must not let those wipe the country.
  const [capFrom, setCapFrom] = useState<CourierLocation>(from)
  const [capTo, setCapTo] = useState<CourierLocation>(to)

  function handleFrom(address: string, c?: Partial<CourierLocation>) {
    if (c && (c.countryCode || c.city || c.postcode)) {
      const next = { countryCode: c.countryCode ?? '', city: (c.city || (c as { state?: string }).state) ?? '', postcode: c.postcode ?? '' }
      setCapFrom(next)
      onFromChange(address, next)
    } else {
      onFromChange(address, {})
    }
  }

  function handleTo(address: string, c?: Partial<CourierLocation>) {
    if (c && (c.countryCode || c.city || c.postcode)) {
      const next = { countryCode: c.countryCode ?? '', city: (c.city || (c as { state?: string }).state) ?? '', postcode: c.postcode ?? '' }
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
      const res = await runDhlCourier(body)
      if (!res.ok) {
        setSearchError([res.reason, res.detail].filter(Boolean).join(' - '))
        return
      }
      const raw = res.options?.length ? res.options : res.best ? [res.best] : []
      setCourierOptions(raw.map(dhlToSelectorOption))
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
          <AddressAutocomplete
            label=""
            value={fromAddress}
            usePlaces
            onChange={(address, c) => handleFrom(address, c)}
          />
        </label>

        <div className="acp__field">
          <span className="acp__label">Destination</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <AddressAutocomplete
                label=""
                value={toAddress}
                usePlaces
                onChange={(address, c) => handleTo(address, c)}
              />
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
        <button
          type="button"
          className="btn btn--inline"
          style={{ marginTop: 0, whiteSpace: 'nowrap' }}
          onClick={() => void searchRates()}
          disabled={searching}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchError && (
        <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>{searchError}</p>
      )}

      {courierOptions.length > 0 && (
        <CourierCourierSelector options={courierOptions} value={selectedCourier} onChange={setSelectedCourier} />
      )}
    </div>
  )
}



