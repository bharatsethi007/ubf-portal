import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import {
  laneChargeStats, lastQuotesForLane, incotermDescription,
  type LaneChargeStat, type LaneQuote,
} from './freightIntelligenceApi'

type Props = {
  from: string | null
  to: string | null
  mode: 'air' | 'sea'
  direction: string | null
  incoterm: string | null
  onClose?: () => void
}

// Small char-by-char typewriter for the "thinking → typing" feel.
function useTypewriter(text: string, speed = 18): string {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!text) return
    const id = setInterval(() => setN((p) => { if (p >= text.length) { clearInterval(id); return p } return p + 1 }), speed)
    return () => clearInterval(id)
  }, [text, speed])
  return text.slice(0, n)
}

const THINKING = ['Reading past shipments on this lane…', 'Counting how often each charge appears…', 'Excluding duty & GST pass-throughs…', 'Compiling the expected charge set…']

function band(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: 'Almost always', color: '#1F8A4C' }
  if (pct >= 50) return { label: 'Usually', color: '#B4791F' }
  return { label: 'Sometimes', color: '#6B7280' }
}

export default function FreightIntelligence({ from, to, mode, direction, incoterm, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<LaneChargeStat[]>([])
  const [quotes, setQuotes] = useState<LaneQuote[]>([])
  const [thinkIdx, setThinkIdx] = useState(0)
  const [ready, setReady] = useState(false)
  const reqId = useRef(0)

  const active = !!(from && to)
  const incoDesc = incotermDescription(incoterm)

  // rotate the thinking lines while loading
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setThinkIdx((i) => (i + 1) % THINKING.length), 900)
    return () => clearInterval(id)
  }, [loading])

  useEffect(() => {
    if (!active) { setStats([]); setQuotes([]); setReady(false); return }
    const id = ++reqId.current
    setLoading(true); setReady(false); setThinkIdx(0)
    ;(async () => {
      try {
        const [s, q] = await Promise.all([
          laneChargeStats(from!, to!, mode, direction || (mode === 'air' ? 'import' : 'import')),
          lastQuotesForLane(from!, to!, 5),
        ])
        if (id !== reqId.current) return
        setStats(s); setQuotes(q)
      } catch {
        if (id !== reqId.current) return
        setStats([]); setQuotes([])
      } finally {
        if (id === reqId.current) { setLoading(false); setReady(true) }
      }
    })()
  }, [active, from, to, mode, direction])

  const jobCount = stats[0]?.jobCount ?? 0
  const headline = ready
    ? (jobCount > 0
        ? `Based on ${jobCount} past shipment${jobCount === 1 ? '' : 's'} on ${from} → ${to}, here's what this lane usually carries.`
        : `No past shipments found for ${from} → ${to}. I can't infer a charge set for this lane yet.`)
    : ''
  const typed = useTypewriter(headline)

  if (!active) return null

  return (
    <aside style={{ position: 'fixed', right: 20, top: 110, width: 344, maxHeight: 'calc(100vh - 140px)', overflow: 'auto', zIndex: 40,
      background: '#fff', border: '1px solid var(--color-line, #e3e7ed)', borderRadius: 16, boxShadow: '0 12px 40px rgba(10,36,114,.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid #eef2f6' }}>
        <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#0A2472,#3B5BFE)', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={14} color="#fff" />
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0A2472' }}>Freight Intelligence</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Hide" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #dbe2ef', borderTopColor: '#0A2472', display: 'inline-block', animation: 'fi-spin .7s linear infinite' }} />
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{THINKING[thinkIdx]}</span>
            <style>{'@keyframes fi-spin{to{transform:rotate(360deg)}}@keyframes fi-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'}</style>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 12px', color: '#1A2233', minHeight: 40 }}>
              {typed}<span style={{ opacity: typed.length < headline.length ? 1 : 0 }}>▌</span>
            </p>

            {incoDesc && (
              <div style={{ animation: 'fi-in .35s ease both', marginBottom: 14 }}>
                <div style={sectionLabel}>Incoterm · {(incoterm || '').toUpperCase()}</div>
                <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0, color: '#475064' }}>{incoDesc}</p>
              </div>
            )}

            {stats.length > 0 && (
              <div style={{ animation: 'fi-in .35s ease .1s both', marginBottom: 14 }}>
                <div style={sectionLabel}>Usual charges on this lane</div>
                {stats.map((s, i) => {
                  const b = band(s.pct)
                  return (
                    <div key={s.code} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0', borderBottom: '1px solid #f2f5f8', animation: `fi-in .3s ease ${0.12 + i * 0.035}s both` }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A2233', minWidth: 54 }}>{s.code}</span>
                      <span style={{ fontSize: 12, color: '#475064', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: b.color, whiteSpace: 'nowrap' }}>{s.pct}%</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10.5, color: 'var(--muted-foreground)' }}>
                  <span><b style={{ color: '#1F8A4C' }}>■</b> always</span>
                  <span><b style={{ color: '#B4791F' }}>■</b> usually</span>
                  <span><b style={{ color: '#6B7280' }}>■</b> sometimes</span>
                </div>
              </div>
            )}

            {quotes.length > 0 && (
              <div style={{ animation: 'fi-in .35s ease .2s both' }}>
                <div style={sectionLabel}>Recent quotes on this lane</div>
                {quotes.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: '#0A2472', minWidth: 66 }}>{q.quoteNo || '—'}</span>
                    <span style={{ color: '#475064', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.customer || '—'}</span>
                    {q.status && <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>{q.status}</span>}
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '14px 0 0', lineHeight: 1.4 }}>
              From your billed history — a completeness guide, not a price. GST/duty pass-throughs excluded.
            </p>
          </>
        )}
      </div>
    </aside>
  )
}

const sectionLabel = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, color: '#0A2472', marginBottom: 6 }
