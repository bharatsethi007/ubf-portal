import type { CourierTrackEvent } from './courierBookingsApi'

type Props = {
  events: CourierTrackEvent[]
  busy?: boolean
}

function val(e: CourierTrackEvent, ...keys: string[]): string {
  for (const k of keys) {
    const v = (e as Record<string, unknown>)[k]
    if (v != null && String(v).trim()) return String(v)
  }
  return ''
}

function fmtWhen(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CourierTrackingPanel({ events, busy }: Props) {
  // oldest -> newest, left to right
  const rows = [...(events ?? [])].sort((a, b) => {
    const ta = new Date(val(a, 'timestamp', 'date')).getTime() || 0
    const tb = new Date(val(b, 'timestamp', 'date')).getTime() || 0
    return ta - tb
  })

  return (
    <section className="card booking-form-card">
      <h3 className="booking-form-card__title">Tracking</h3>
      <div className="booking-form-card__body">
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {busy ? 'Fetching tracking...' : 'No tracking events yet.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'min-content' }}>
              {rows.map((e, i) => {
                const when = fmtWhen(val(e, 'timestamp', 'date'))
                const desc = val(e, 'description', 'status', 'statusCode') || 'Update'
                const loc = val(e, 'location')
                const isLast = i === rows.length - 1
                const isLatest = i === rows.length - 1
                return (
                  <div key={i} style={{ flex: '1 1 0', minWidth: 150, position: 'relative' }}>
                    {/* connector line to the next node */}
                    {!isLast && (
                      <span style={{ position: 'absolute', top: 6, left: '50%', right: '-50%', height: 2, background: '#e5e7eb' }} />
                    )}
                    {/* dot */}
                    <span style={{ position: 'relative', display: 'block', width: 14, height: 14, borderRadius: '50%', background: isLatest ? '#2563eb' : '#cbd5e1', margin: '0 auto', zIndex: 1 }} />
                    {/* label */}
                    <div style={{ textAlign: 'center', padding: '10px 8px 0' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{desc}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{when}</div>
                      {loc ? <div style={{ fontSize: 11, color: '#94a3b8' }}>{loc}</div> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
