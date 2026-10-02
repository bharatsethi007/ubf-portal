import { Anchor } from 'lucide-react'
import type { Sailings } from './factsApi'

const d = (s: string) => new Date(s).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
const title = (v: string) => v.split(' ').map((w) => (/\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ')

export default function IntelSailings({ s }: { s: Sailings }) {
  if (!s.upcoming.length && !s.gapDays) return null
  const cadence = s.gapDays ? `Departs about every ${s.gapDays} day${s.gapDays === 1 ? '' : 's'}` : null
  return (
    <div className="fi-sec" style={{ animationDelay: '.14s' }}>
      <div className="fi-label">Sailings<span className="fi-label__aside">{cadence}</span></div>
      {s.upcoming.map((u, i) => (
        <div key={u.voyage} className="fi-sail" style={{ animationDelay: `${0.18 + i * 0.06}s` }}>
          <Anchor size={13} color="#0A2472" />
          <span className="fi-sail__v">{title(u.voyage)}</span>
          <span className="fi-sail__d">{d(u.etd)}</span>
          <span className="fi-chip" style={{ background: '#eef2fb', color: '#0A2472' }}>{u.jobs} on board</span>
        </div>
      ))}
      {!s.upcoming.length && s.lastEtd && <div className="fi-muted">No booked voyage yet. Last left {d(s.lastEtd)}.</div>}
    </div>
  )
}
