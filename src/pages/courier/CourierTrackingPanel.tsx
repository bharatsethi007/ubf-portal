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
  return d.toLocaleString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CourierTrackingPanel({ events, busy }: Props) {
  const rows = [...(events ?? [])].sort((a, b) => {
    const ta = new Date(val(a, 'timestamp', 'date')).getTime() || 0
    const tb = new Date(val(b, 'timestamp', 'date')).getTime() || 0
    return tb - ta
  })

  return (
    <section className="card booking-form-card">
      <h3 className="booking-form-card__title">Tracking</h3>
      <div className="booking-form-card__body">
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {busy ? 'Fetching tracking…' : 'No tracking events yet.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((e, i) => {
              const when = fmtWhen(val(e, 'timestamp', 'date'))
              const desc = val(e, 'description', 'status', 'statusCode') || 'Update'
              const loc = val(e, 'location')
              const last = i === rows.length - 1
              return (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: i === 0 ? '#2563eb' : '#cbd5e1', marginTop: 4, flexShrink: 0 }} />
                    {!last && <span style={{ width: 2, flex: 1, background: '#e5e7eb', minHeight: 22 }} />}
                  </div>
                  <div style={{ paddingBottom: last ? 0 : 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{desc}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {when}{loc ? ` · ${loc}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
