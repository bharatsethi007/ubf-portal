import { useEffect, useState } from 'react'
import { fetchRateRequestContext, buildRateRequestEmail, type RateRequestContext } from './rateRequestApi'

export default function QuoteRequestRates({ quoteId }: { quoteId: string }) {
  const [ctx, setCtx] = useState<RateRequestContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr('')
    fetchRateRequestContext(quoteId)
      .then((c) => { if (cancelled) return; setCtx(c); const e = buildRateRequestEmail(c); setSubject(e.subject); setBody(e.body) })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [quoteId])

  if (loading) return <p className="qr-placeholder">Preparing rate request…</p>
  if (err) return <p className="qr-placeholder" style={{ color: '#B23B3B' }}>{err}</p>
  if (!ctx) return null
  if (!ctx.polCode || !ctx.podCode) return <p className="qr-placeholder">Set an origin and destination port on this quote to draft a rate request.</p>
  if (!ctx.movement || !ctx.incoterm) return <p className="qr-placeholder">Set the movement (import/export) and incoterm on this quote so we can work out which charges to request.</p>

  const askChips: string[] = []
  if (ctx.requestFreight) askChips.push('Freight')
  if (ctx.requestLocal) askChips.push(ctx.agentEnd === 'origin' ? 'Origin local' : 'Destination local')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2472' }}>{ctx.polCode} → {ctx.podCode}</span>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{ctx.modeLabel} · {ctx.incoterm} · {ctx.movement === 'export' ? 'Export' : 'Import'}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, alignItems: 'center' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>
          Requesting from agent at {ctx.agentEnd === 'origin' ? 'origin' : 'destination'} ({ctx.agentCountry ?? '—'}):
        </span>
        {askChips.length ? askChips.map((c) => (
          <span key={c} style={{ background: '#EEF1FB', color: '#0A2472', borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>{c}</span>
        )) : <span style={{ color: '#B4791F' }}>No agent charges needed for this incoterm — UBF prices this lane locally.</span>}
      </div>
      {ctx.ruleNote && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{ctx.ruleNote}</p>}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Subject</span>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Email body</span>
        <textarea className="input" style={{ minHeight: 260, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5 }} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>

      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>Next step: pick agents / recipients and send.</p>
    </div>
  )
}
