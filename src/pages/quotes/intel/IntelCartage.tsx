import { useState } from 'react'
import { Truck, Plus, AlertTriangle } from 'lucide-react'
import type { CartageSuggestion } from './cartageSuggest'

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`

export default function IntelCartage({ s, canAdd, onAdd }: { s: CartageSuggestion; canAdd: boolean; onAdd: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  if (s.status !== 'ok') {
    return (
      <div className="fi-check fi-check--info" style={{ animationDelay: '.06s' }}>
        <AlertTriangle size={14} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ minWidth: 0 }}>
          <div className="fi-check__t">No cartage rate for door {s.door}</div>
          <div className="fi-check__s">{s.status === 'no_zone' ? 'Address matched no zone. Fix it in Cartage rate search below, it will be learned.' : `No cartage lane to ${s.port}. Check the cartage rate card.`}</div>
        </div>
      </div>
    )
  }
  const c = s.cartage
  const leg = c.leg === 'origin' ? 'pickup' : 'delivery'
  return (
    <div className="fi-check fi-check--warn fi-cart" style={{ animationDelay: '.06s' }}>
      <Truck size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="fi-check__t">No {leg} cartage on quote</div>
        <div className="fi-check__s">
          {c.carrier ?? 'UBF'} {money(c.amount)} · {c.leg === 'origin' ? `${s.door} → ${s.port}` : `${s.port} → ${s.door}`}
          {c.confidence && c.confidence !== 'green' ? ' · zone guessed, check' : ''}
          {s.alt.length > 0 && ` · next ${s.alt.map((a) => `${a.carrier} ${money(a.charge || a.cost)}`).join(', ')}`}
        </div>
      </div>
      {canAdd && (
        <button type="button" className="fi-add" title={`Add cartage ${money(c.amount)}`} aria-label="Add cartage" disabled={busy}
          onClick={async () => { setBusy(true); try { await onAdd() } finally { setBusy(false) } }}>
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}
