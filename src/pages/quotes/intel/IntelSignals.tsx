import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { Signal } from './signals'

export default function IntelSignals({ signals, quiet }: { signals: Signal[]; quiet: boolean }) {
  if (!signals.length) {
    if (!quiet) return null
    return (
      <div className="fi-sec" style={{ animationDelay: '.04s' }}>
        <div className="fi-check fi-check--ok"><CheckCircle2 size={14} color="#1F8A4C" /><div className="fi-check__t">Nothing to flag on this quote</div></div>
      </div>
    )
  }
  return (
    <div className="fi-sec" style={{ animationDelay: '.04s' }}>
      <div className="fi-label">Needs attention<span className="fi-label__aside">{signals.length}</span></div>
      <div className="fi-checks">
        {signals.map((s, i) => {
          const Icon = s.level === 'warn' ? AlertTriangle : Info
          return (
            <div key={s.id} className={`fi-check fi-check--${s.level}`} style={{ animationDelay: `${0.08 + i * 0.05}s` }}>
              <Icon size={14} color={s.level === 'warn' ? '#D97706' : '#2563eb'} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div className="fi-check__t">{s.text}</div>
                {s.sub && <div className="fi-check__s">{s.sub}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
