import SeaPortSelect from '../../components/bookings/SeaPortSelect'
import type { QuoteDraft } from './quotesApi'

const TYPES = ['Port/Airport', 'Factory/Warehouse', 'Business address', 'Residential address'] as const

type Side = 'origin' | 'destination'

const KEYS: Record<Side, {
  label: string
  typeKey: keyof QuoteDraft
  portKey: keyof QuoteDraft
  locKey: keyof QuoteDraft
  postalKey: keyof QuoteDraft
  addrKey: keyof QuoteDraft
}> = {
  origin: {
    label: 'Origin',
    typeKey: 'origin_location_type',
    portKey: 'from_port_code',
    locKey: 'pickup_location',
    postalKey: 'pickup_postal_code',
    addrKey: 'pickup_address',
  },
  destination: {
    label: 'Destination',
    typeKey: 'dest_location_type',
    portKey: 'to_port_code',
    locKey: 'drop_location',
    postalKey: 'drop_postal_code',
    addrKey: 'drop_address',
  },
}

type Props = {
  side: Side
  draft: QuoteDraft
  onPatch: (p: Partial<QuoteDraft>) => void
}

export default function QuoteOriginDestField({ side, draft, onPatch }: Props) {
  const k = KEYS[side]
  const type = (draft[k.typeKey] as string | null) ?? 'Port/Airport'
  const isPort = type === 'Port/Airport'
  const str = (key: keyof QuoteDraft) => (draft[key] as string | null) ?? ''

  return (
    <div className="nqs-od">
      <div className="nqs-od__label">
        {k.label} —{' '}
        <select
          className="nqs-od__type"
          style={{ display: 'inline', width: 'auto' }}
          value={type}
          onChange={(e) => onPatch({ [k.typeKey]: e.target.value })}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>{t.toLowerCase()}</option>
          ))}
        </select>
      </div>

      {isPort ? (
        <SeaPortSelect
          value={str(k.portKey)}
          onChange={(v) => onPatch({ [k.portKey]: v || null })}
          placeholder={side === 'origin' ? 'From port' : 'To port'}
        />
      ) : (
        // Address types — plain fields for now. Google Places autocomplete
        // mounts here once VITE_GOOGLE_MAPS_API_KEY is configured.
        <div className="nqs-od__addr">
          <input
            type="text"
            placeholder="City / location"
            value={str(k.locKey)}
            onChange={(e) => onPatch({ [k.locKey]: e.target.value || null })}
          />
          <input
            type="text"
            placeholder="Postal code"
            value={str(k.postalKey)}
            onChange={(e) => onPatch({ [k.postalKey]: e.target.value || null })}
          />
          <textarea
            rows={2}
            placeholder="Address"
            value={str(k.addrKey)}
            onChange={(e) => onPatch({ [k.addrKey]: e.target.value || null })}
          />
        </div>
      )}
    </div>
  )
}
