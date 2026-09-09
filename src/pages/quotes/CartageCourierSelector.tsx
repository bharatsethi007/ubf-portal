import { Truck } from 'lucide-react'
import { carrierLogo } from './cartageSearchApi'

type Opt = { carrier: string; service: string; charge: number; cost: number; rural: boolean }

export default function CartageCourierSelector({ title, options, selected, onSelect }: {
  title: string; options: Opt[]; selected: number; onSelect: (i: number) => void
}) {
  return (
    <div className="card quotes-page__card" style={{ padding: 14, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Truck size={16} />
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <span className="text-muted-foreground" style={{ fontSize: 12 }}>· {options.length} option{options.length === 1 ? '' : 's'} · {options.filter((o) => o.carrier === 'Bascik').length} Bascik · pick one</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((o, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: selected === i ? '#EEF2FF' : 'transparent', border: '1px solid ' + (selected === i ? '#2563eb' : 'var(--color-line)') }}>
            <input type="radio" checked={selected === i} onChange={() => onSelect(i)} />
            {carrierLogo(o.carrier)
              ? <img src={carrierLogo(o.carrier) as string} alt={o.carrier} title={o.carrier} style={{ height: 20, width: 64, objectFit: 'contain' }} />
              : <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#0A2472', color: '#fff', whiteSpace: 'nowrap' }}>{o.carrier}</span>}
            <span style={{ fontSize: 13 }}>{o.service}{o.rural ? ' · rural' : ''}</span>
            <strong style={{ marginLeft: 'auto', fontSize: 14 }}>NZD {o.charge.toLocaleString()}</strong>
          </label>
        ))}
      </div>
    </div>
  )
}
