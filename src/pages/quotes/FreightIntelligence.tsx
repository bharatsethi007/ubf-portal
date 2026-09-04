import { useEffect, useRef, useState } from 'react'
import { Sparkles, ChevronDown, Calculator } from 'lucide-react'
import {
  laneChargeStats, lastQuotesForLane, incotermDescription,
  type LaneChargeStat, type LaneQuote,
} from './freightIntelligenceApi'
import { checkDuty, dutyNoteLine, type DutyResult } from './dutyCheckApi'

type Props = {
  from: string | null
  to: string | null
  mode: 'air' | 'sea'
  direction: string | null
  incoterm: string | null
  onAddNote?: (line: string) => void   // present on the quote page → enables "add to notes"
}

function useTypewriter(text: string, run: boolean, speed = 16): string {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!run || !text) return
    const id = setInterval(() => setN((p) => { if (p >= text.length) { clearInterval(id); return p } return p + 1 }), speed)
    return () => clearInterval(id)
  }, [text, run, speed])
  return text.slice(0, n)
}

const THINKING = ['Reading past shipments on this lane…', 'Counting how often each charge appears…', 'Excluding duty & GST pass-throughs…', 'Compiling the expected charge set…']

function band(pct: number): string {
  if (pct >= 80) return '#1F8A4C'
  if (pct >= 50) return '#B4791F'
  return '#6B7280'
}

const sectionLabel = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, color: '#0A2472', marginBottom: 6 }

export default function FreightIntelligence({ from, to, mode, direction, incoterm, onAddNote }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<LaneChargeStat[]>([])
  const [quotes, setQuotes] = useState<LaneQuote[]>([])
  const [thinkIdx, setThinkIdx] = useState(0)
  const [ready, setReady] = useState(false)
  const reqId = useRef(0)
  const [dutyOpen, setDutyOpen] = useState(false)
  const [commodity, setCommodity] = useState('')
  const [dutyValue, setDutyValue] = useState('')
  const [originCountry, setOriginCountry] = useState('')
  const [dutyLoading, setDutyLoading] = useState(false)
  const [dutyResult, setDutyResult] = useState<DutyResult | null>(null)
  const [dutyErr, setDutyErr] = useState('')
  const [added, setAdded] = useState(false)

  async function runDuty() {
    if (!commodity.trim() || dutyLoading) return
    setDutyLoading(true); setDutyErr(''); setDutyResult(null); setAdded(false)
    try {
      const r = await checkDuty({ commodity: commodity.trim(), value: Number(dutyValue) || 0, originCountry: originCountry.trim() })
      setDutyResult(r)
    } catch (e) {
      setDutyErr(e instanceof Error ? e.message : 'Duty check failed')
    } finally {
      setDutyLoading(false)
    }
  }

  const laneReady = !!(from && to)
  const incoDesc = incotermDescription(incoterm)

  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setThinkIdx((i) => (i + 1) % THINKING.length), 900)
    return () => clearInterval(id)
  }, [loading])

  // Fetch ONLY when opened (and re-fetch if the lane changes while open).
  useEffect(() => {
    if (!open || !laneReady) { return }
    const id = ++reqId.current
    setLoading(true); setReady(false); setThinkIdx(0)
    ;(async () => {
      try {
        const [s, q] = await Promise.all([
          laneChargeStats(from!, to!, mode, direction || ''),
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
  }, [open, laneReady, from, to, mode, direction])

  const jobCount = stats[0]?.jobCount ?? 0
  const headline = ready
    ? (jobCount > 0
        ? `Based on ${jobCount.toLocaleString()} past shipment${jobCount === 1 ? '' : 's'} on ${from} → ${to}, here's what this lane usually carries.`
        : `No past shipments found for ${from} → ${to}${direction ? ` (${direction})` : ''}. I can't infer a charge set for this lane yet.`)
    : ''
  const typed = useTypewriter(headline, open && ready)

  if (!laneReady) return null

  // Collapsed: a floating icon button, bottom-right.
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Freight Intelligence"
        title="Freight Intelligence"
        style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 40, width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#0A2472,#3B5BFE)', boxShadow: '0 8px 24px rgba(10,36,114,.32)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={22} color="#fff" />
      </button>
    )
  }

  // Open: panel anchored bottom-right, grows upward into the empty space.
  return (
    <aside style={{ position: 'fixed', right: 24, bottom: 24, width: 360, maxHeight: '62vh', overflow: 'auto', zIndex: 40,
      background: '#fff', border: '1px solid var(--color-line, #e3e7ed)', borderRadius: 16, boxShadow: '0 16px 48px rgba(10,36,114,.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid #eef2f6', position: 'sticky', top: 0, background: '#fff' }}>
        <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#0A2472,#3B5BFE)', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={14} color="#fff" />
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0A2472' }}>Freight Intelligence</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Collapse" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'inline-flex' }}>
          <ChevronDown size={18} />
        </button>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <style>{'@keyframes fi-spin{to{transform:rotate(360deg)}}@keyframes fi-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'}</style>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #dbe2ef', borderTopColor: '#0A2472', display: 'inline-block', animation: 'fi-spin .7s linear infinite' }} />
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{THINKING[thinkIdx]}</span>
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
                {stats.map((s, i) => (
                  <div key={s.code} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0', borderBottom: '1px solid #f2f5f8', animation: `fi-in .3s ease ${0.12 + i * 0.03}s both` }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A2233', minWidth: 52 }}>{s.code}</span>
                    <span style={{ fontSize: 12, color: '#475064', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: band(s.pct), whiteSpace: 'nowrap' }}>{s.avgSell != null ? `~$${s.avgSell.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10.5, color: 'var(--muted-foreground)' }}>
                  <span>~$ = avg sell ·</span>
                  <span><b style={{ color: '#1F8A4C' }}>■</b> always</span>
                  <span><b style={{ color: '#B4791F' }}>■</b> usually</span>
                  <span><b style={{ color: '#6B7280' }}>■</b> sometimes</span>
                </div>
              </div>
            )}

            {quotes.length > 0 && (
              <div style={{ animation: 'fi-in .35s ease .2s both' }}>
                <div style={sectionLabel}>Recent quotes on this lane</div>
                {quotes.map((q) => (
                  <a key={q.id} href={`/quotes/${q.id}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', fontSize: 12, textDecoration: 'none' }}>
                    <span style={{ fontWeight: 600, color: '#0A2472', minWidth: 66, textDecoration: 'underline' }}>{q.quoteNo || 'view'}</span>
                    <span style={{ color: '#475064', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.customer || '—'}</span>
                    {q.status && <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>{q.status}</span>}
                  </a>
                ))}
              </div>
            )}

            <div style={{ animation: 'fi-in .35s ease .28s both', marginTop: 14, borderTop: '1px solid #eef2f6', paddingTop: 12 }}>
              <button type="button" onClick={() => setDutyOpen((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, ...sectionLabel, marginBottom: dutyOpen ? 8 : 0 }}>
                <Calculator size={13} /> Check duty (indicative)
                <ChevronDown size={14} style={{ marginLeft: 'auto', transform: dutyOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {dutyOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <input className="input input--sm" placeholder="Commodity (e.g. cotton t-shirts)" value={commodity} onChange={(e) => setCommodity(e.target.value)} />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <input className="input input--sm" style={{ flex: 1 }} placeholder="Value (NZD)" inputMode="decimal" value={dutyValue} onChange={(e) => setDutyValue(e.target.value)} />
                    <input className="input input--sm" style={{ flex: 1 }} placeholder="Origin country" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} />
                  </div>
                  <button type="button" className="btn btn--inline" onClick={runDuty} disabled={dutyLoading || !commodity.trim()} style={{ alignSelf: 'flex-start' }}>
                    {dutyLoading ? 'Checking…' : 'Check duty'}
                  </button>
                  {dutyErr && <span style={{ fontSize: 11.5, color: '#B23B3B' }}>{dutyErr}</span>}
                  {dutyResult && (
                    <div style={{ background: '#F7F9FC', border: '1px solid #e6ebf2', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#1A2233' }}>
                      <div><b>HS {dutyResult.hsCode}</b> — {dutyResult.hsDescription}</div>
                      <div style={{ marginTop: 4 }}>Duty {dutyResult.dutyRatePct > 0 ? `${dutyResult.dutyRatePct}% (~${dutyResult.currency} ${dutyResult.estimatedDuty.toLocaleString()})` : 'Free'} · GST {dutyResult.gstRatePct}% (~{dutyResult.currency} {dutyResult.estimatedGst.toLocaleString()})</div>
                      <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--muted-foreground)' }}>Confidence: {dutyResult.confidence}. {dutyResult.disclaimer}</div>
                      {onAddNote ? (
                        <button type="button" className="btn btn--inline" style={{ marginTop: 8 }} disabled={added}
                          onClick={() => { onAddNote(dutyNoteLine(dutyResult)); setAdded(true) }}>
                          {added ? 'Added to quote notes ✓' : 'Add to quote notes'}
                        </button>
                      ) : (
                        <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--muted-foreground)' }}>Open a quote to add this to its notes.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '14px 0 0', lineHeight: 1.4 }}>
              From your billed history — a completeness guide, not a price. GST/duty pass-throughs excluded.
            </p>
          </>
        )}
      </div>
    </aside>
  )
}
