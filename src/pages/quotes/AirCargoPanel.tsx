import AddressAutocomplete from '../../components/bookings/AddressAutocomplete'
import IncotermSelect from '../../components/bookings/IncotermSelect'
import QuoteCargoEntry, { type CargoEntryMode } from './QuoteCargoEntry'
import { type QuoteCargoLine } from './quoteCargoApi'
import './airCargoPanel.css'

type Props = {
  incoterm: string
  onIncotermChange: (v: string) => void
  incotermPlace: string
  onIncotermPlaceChange: (v: string) => void
  originAddress: string
  onOriginAddressChange: (v: string) => void
  deliveryAddress: string
  onDeliveryAddressChange: (v: string) => void
  lines: QuoteCargoLine[]
  entryMode: CargoEntryMode
  onEntryModeChange: (m: CargoEntryMode) => void
  onLinesChange: (lines: QuoteCargoLine[]) => void
  onAddLine: () => void
}

// Address fields by incoterm.
// EXW/FCA -> origin + delivery; FAS/FOB/CPT/CIP/DAP/DPU/DDP -> delivery only; CFR/CIF -> none.
export function addressFieldsFor(incoterm: string): { origin: boolean; delivery: boolean } {
  const c = (incoterm || '').toUpperCase()
  if (c === 'EXW' || c === 'FCA') return { origin: true, delivery: true }
  if (['FAS', 'FOB', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'].includes(c)) return { origin: false, delivery: true }
  return { origin: false, delivery: false }
}

export default function AirCargoPanel({
  incoterm, onIncotermChange, incotermPlace, onIncotermPlaceChange,
  originAddress, onOriginAddressChange, deliveryAddress, onDeliveryAddressChange,
  lines, entryMode, onEntryModeChange, onLinesChange, onAddLine,
}: Props) {
  const addr = addressFieldsFor(incoterm)

  return (
    <div className="acp">
      <div className="acp__row">
        <label className="acp__field">
          <span className="acp__label">Incoterm</span>
          <IncotermSelect value={incoterm} onChange={onIncotermChange} airOnly />
        </label>
        <label className="acp__field">
          <span className="acp__label">Named place (opt.)</span>
          <input className="nqd-input" value={incotermPlace}
            onChange={(e) => onIncotermPlaceChange(e.target.value)} placeholder="e.g. AKL" />
        </label>
      </div>

      {(addr.origin || addr.delivery) && (
        <div className="acp__addrs">
          {addr.origin && (
            <label className="acp__field">
              <span className="acp__label">Origin address</span>
              <AddressAutocomplete label="" value={originAddress}
                onChange={(a) => onOriginAddressChange(a)} usePlaces={!originAddress.trim()} />
            </label>
          )}
          {addr.delivery && (
            <label className="acp__field">
              <span className="acp__label">Delivery address</span>
              <AddressAutocomplete label="" value={deliveryAddress}
                onChange={(a) => onDeliveryAddressChange(a)} usePlaces={!deliveryAddress.trim()} />
            </label>
          )}
        </div>
      )}

      <QuoteCargoEntry
        mode="air" entryMode={entryMode} onEntryModeChange={onEntryModeChange}
        lines={lines} onChange={onLinesChange} onAddLine={onAddLine}
      />
    </div>
  )
}
