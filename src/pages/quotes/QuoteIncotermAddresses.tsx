import IncotermSelect from '../../components/bookings/IncotermSelect'
import AddressAutocomplete from '../../components/bookings/AddressAutocomplete'
import { addressFieldsFor } from './AirCargoPanel'

const MOVEMENTS = [{ value: 'import', label: 'Import' }, { value: 'export', label: 'Export' }]

type Props = {
  incoterm: string; onIncotermChange: (v: string) => void
  movement: string; onMovementChange: (v: string) => void
  originAddress: string; onOriginAddressChange: (v: string) => void
  deliveryAddress: string; onDeliveryAddressChange: (v: string) => void
}

// Same incoterm-driven address logic as Air/FCL, for LCL. Model B: incoterm sets the
// default, and the NZ door leg is always available (export -> origin, import -> delivery).
export default function QuoteIncotermAddresses(p: Props) {
  const addr = addressFieldsFor(p.incoterm, p.movement)
  return (
    <div className="acp" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="acp__field">
          <span className="acp__label">Type</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {MOVEMENTS.map((m) => (
              <button key={m.value} type="button" className={`cg-chip${p.movement === m.value ? ' cg-chip--on' : ''}`} onClick={() => p.onMovementChange(m.value)}>{m.label}</button>
            ))}
          </div>
        </label>
        <label className="acp__field">
          <span className="acp__label">Incoterm</span>
          <IncotermSelect value={p.incoterm} onChange={p.onIncotermChange} />
        </label>
      </div>
      {addr.origin && (
        <label className="acp__field">
          <span className="acp__label">Origin address</span>
          <AddressAutocomplete label="" value={p.originAddress} onChange={(a) => p.onOriginAddressChange(a)} usePlaces={!p.originAddress.trim()} />
        </label>
      )}
      {addr.delivery && (
        <label className="acp__field">
          <span className="acp__label">Delivery address</span>
          <AddressAutocomplete label="" value={p.deliveryAddress} onChange={(a) => p.onDeliveryAddressChange(a)} usePlaces={!p.deliveryAddress.trim()} />
        </label>
      )}
    </div>
  )
}
