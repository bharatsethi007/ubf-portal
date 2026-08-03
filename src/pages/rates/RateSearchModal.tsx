import { useEffect, useState } from 'react'
import { Sparkles, Search, X, Plus, Trash2 } from 'lucide-react'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import SeaPortSelect from '../../components/bookings/SeaPortSelect'
import { fetchPortAliases, searchFclRates, type RateOption, type QuoteLane } from './rateSearchApi'
import { resolveRateQuery } from './rateChatResolver'
import RateOptionCard from './RateOptionCard'

const SIZES = ['20', '40', '20HC', '40HC'] as const
type Load = { size: string; qty: number }

export default function RateSearchModal({ onUseRate, onClose, initialQuery = '' }: {
  onUseRate: (o: RateOption, lane: QuoteLane) => Promise<void> | void
  onClose: () => void
  initialQuery?: string
}) {
  const { ports } = useSeaPorts()
  const [aliases, setAliases] = useState<{ alias: string; port_code: string }[]>([])
  const [ai, setAi] = useState(initialQuery)
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [loads, setLoads] = useState<Load[]>([{ size: '20', qty: 1 }])
  const [busy, setBusy] = useState(false)
  const [usingId, setUsingId] = useState<string | null>(null)
  const [results, setResults] = useState<RateOption[] | null>(null)
  const [lane, setLane] = useState<QuoteLane | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => { fetchPortAliases().then(setAliases).catch(() => {}) }, [])

  async function run(l: QuoteLane, hint = '') {
    setBusy(true); setNote(hint); setLane(l)
    try { setResults(await searchFclRates(l)) }
    catch (e) { setResults([]); setNote(e instanceof Error ? e.message : 'Search failed') }
    finally { setBusy(false) }
  }

  async function runAi() {
    const text = ai.trim()
    if (!text || busy) return
    const r = resolveRateQuery(text, ports.map((p) => ({ code: p.code, name: p.name })), aliases)
    if (!r.from || !r.to) {
      setResults([]); setLane(null)
      setNote(!r.from && !r.to ? 'Name both ports, e.g. “Shanghai to Auckland”.' : !r.from ? 'Caught the destination but not the origin.' : 'Caught the origin but not the destination.')
      return
    }
    setOrigin(r.from.code); setDest(r.to.code); setLoads(r.containers)
    await run({ from_port_code: r.from.code, to_port_code: r.to.code, currency: null, containers: r.containers }, r.assumedContainer ? 'Assumed 1×20ft — adjust loads if needed.' : '')
  }

  async function runManual() {
    if (!origin || !dest) { setNote('Pick both origin and destination ports.'); return }
    if (busy) return
    await run({ from_port_code: origin, to_port_code: dest, currency: null, containers: loads })
  }

  // auto-run when opened with a seeded query (once ports are available)
  useEffect(() => { if (initialQuery.trim()) runAi() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ports.length])

  async function use(o: RateOption) {
    if (!lane || usingId) return
    setUsingId(o.cardId)
    try { await onUseRate(o, lane); onClose() }
    catch (e) { setNote(e instanceof Error ? e.message : 'Could not use that rate') }
    finally { setUsingId(null) }
  }

  const updLoad = (i: number, patch: Partial<Load>) => setLoads((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 130, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflow: 'auto' }}>
      <div style={{ width: 'min(760px, 100%)', background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', color: '#fff', background: 'linear-gradient(120deg,#0A2472,#3B5BFE 55%,#F5A623 150%)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><Sparkles size={16} /> Find rates</div>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 8, padding: 4, cursor: 'pointer', display: 'inline-flex' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={ai} onChange={(e) => setAi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAi() }}
              placeholder="Ask AI — e.g. “Ningbo to Auckland, 2×40ft”"
              style={{ flex: 1, height: 42, padding: '0 14px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14, outline: 'none' }} />
            <button type="button" onClick={runAi} disabled={busy} className="btn btn--inline" style={{ marginTop: 0, height: 42, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={15} /> Search</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted-foreground)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-line)' }} /> or search manually <div style={{ flex: 1, height: 1, background: 'var(--color-line)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SeaPortSelect label="Origin" value={origin} onChange={setOrigin} placeholder="Origin port" />
            <SeaPortSelect label="Destination" value={dest} onChange={setDest} placeholder="Destination port" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}>Loads</span>
            {loads.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input input--sm" value={l.size} onChange={(e) => updLoad(i, { size: e.target.value })} style={{ width: 120 }}>
                  {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="input input--sm" type="number" min={1} value={l.qty} onChange={(e) => updLoad(i, { qty: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 80 }} />
                {loads.length > 1 && <button type="button" onClick={() => setLoads((ls) => ls.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: '#B23B3B', cursor: 'pointer' }}><Trash2 size={15} /></button>}
              </div>
            ))}
            <button type="button" onClick={() => setLoads((ls) => [...ls, { size: '20', qty: 1 }])} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: '#3B5BFE', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}><Plus size={14} /> Add load</button>
            <button type="button" onClick={runManual} disabled={busy} className="btn btn--inline" style={{ marginTop: 4, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Search size={15} /> Search rates</button>
          </div>
          {note && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{note}</p>}
          {busy && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Searching…</p>}
          {!busy && results && results.length === 0 && <p className="text-muted-foreground" style={{ fontSize: 13 }}>No matching rates. Check the lane or that a rate card is Validated/Active.</p>}
          {!busy && results && results.length > 0 && lane && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((o) => (<RateOptionCard key={o.cardId} option={o} fromCode={lane.from_port_code!} toCode={lane.to_port_code!} onUse={() => use(o)} busy={usingId === o.cardId} />))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
