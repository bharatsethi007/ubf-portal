import SeaPortSelect from '../../components/bookings/SeaPortSelect'
import IataPortSelect from '../../components/bookings/IataPortSelect'
import type { QuoteDraft } from './quotesApi'

type Side = 'origin' | 'destination'

const KEYS: Record<Side, { label: string; portKey: keyof QuoteDraft }> = {
  origin: { label: 'Origin', portKey: 'from_port_code' },
  destination: { label: 'Destination', portKey: 'to_port_code' },
}

type Props = {
  side: Side
  draft: QuoteDraft
  onPatch: (p: Partial<QuoteDraft>) => void
  mode?: 'sea' | 'air'
  /** kept for call-site compatibility; the field is always port/airport now */
  hideType?: boolean
}

// Origin/Destination are ALWAYS the port/airport. Whether a door pickup or delivery
// applies is decided by the incoterm (see addressFieldsFor), not a manual toggle.
export default function QuoteOriginDestField({ side, draft, onPatch, mode = 'sea' }: Props) {
  const k = KEYS[side]
  const val = (draft[k.portKey] as string | null) ?? ''
  return (
    <div className="nqs-od nqs-od--inline">
      <div className="nqs-od__label">{k.label}</div>
      {mode === 'air' ? (
        <IataPortSelect value={val} onChange={(v) => onPatch({ [k.portKey]: v || null })} />
      ) : (
        <SeaPortSelect value={val} onChange={(v) => onPatch({ [k.portKey]: v || null })} placeholder={side === 'origin' ? 'From port' : 'To port'} />
      )}
    </div>
  )
}
