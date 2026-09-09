import AddressAutocomplete from '../../components/bookings/AddressAutocomplete'
import CourierPieceRows from './CourierPieceRows'
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
}

export default function CourierCargoPanel({
  isDocuments,
  onIsDocumentsChange,
  fromAddress,
  from: _from,
  onFromChange,
  toAddress,
  to,
  onToChange,
  onToResidentialChange,
  pieces,
  onPiecesChange,
  onAddPiece,
}: CourierCargoPanelProps) {
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
            usePlaces={!fromAddress.trim()}
            onChange={(address, c) => onFromChange(address, {
              countryCode: c?.countryCode ?? '',
              city: c?.city ?? '',
              postcode: c?.postcode ?? '',
            })}
          />
        </label>

        <div className="acp__field">
          <span className="acp__label">Destination</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <AddressAutocomplete
                label=""
                value={toAddress}
                usePlaces={!toAddress.trim()}
                onChange={(address, c) => onToChange(address, {
                  countryCode: c?.countryCode ?? '',
                  city: c?.city ?? '',
                  postcode: c?.postcode ?? '',
                })}
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
    </div>
  )
}
