import AddressAutocomplete from '../../components/bookings/AddressAutocomplete'
import IncotermSelect from '../../components/bookings/IncotermSelect'
import QuoteCargoEntry, { type CargoEntryMode } from './QuoteCargoEntry'
import { type QuoteCargoLine } from './quoteCargoApi'
import './airCargoPanel.css'

const MOVEMENTS: { value: string; label: string }[] = [
  { value: 'import', label: 'Import' },
  { value: 'export', label: 'Export' },
]

type Props = {
  incoterm: string
  onIncotermChange: (v: string) => void
  movement: string
  onMovementChange: (v: string) => void
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
  incoterm, onIncotermChange, movement, onMovementChange,
  originAddress, onOriginAddressChange, deliveryAddress, onDeliveryAddressChange,
  lines, entryMode, onEntryModeChange, onLinesChange, onAddLine,
}: Props) {
  const addr = addressFieldsFor(incoterm)

  return (
    <div className="acp">
      <div className="acp__row">
        <div className="acp__field">
          <span className="acp__label">Type</span>
          <div className="cg-chips">
            {MOVEMENTS.map((m) => (
              <button type="button" key={m.value}
                className={`cg-chip${movement === m.value ? ' cg-chip--on' : ''}`}
                onClick={() => onMovementChange(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <label className="acp__field">
          <span className="acp__label">Incoterm</span>
          <IncotermSelect value={incoterm} onChange={onIncotermChange} airOnly />
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
