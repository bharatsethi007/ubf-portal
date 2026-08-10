import { useEffect, useState } from 'react'
import { Sparkles, Search, X, Plus, Trash2 } from 'lucide-react'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import SeaPortSelect from '../../components/bookings/SeaPortSelect'
import { fetchPortAliases, searchFclRates, type RateOption, type QuoteLane } from './rateSearchApi'
import { searchLclRates, type LclRateOption, type LclQuoteLane } from './lclRateSearchApi'
import { resolveRateQuery } from './rateChatResolver'
import RateOptionCard from './RateOptionCard'
import LclRateOptionCard from './LclRateOptionCard'

const SIZES = ['20', '40', '20HC', '40HC'] as const
type Load = { size: string; qty: number }
type Mode = 'fcl' | 'lcl'

export default function RateSearchModal({ onUseRate, onUseLclRate, onClose, initialQuery = '', initialWm, initialMode = 'fcl' }: {
  onUseRate: (o: RateOption, lane: QuoteLane) => Promise<void> | void
  onUseLclRate?: (o: LclRateOption, lane: LclQuoteLane) => Promise<void> | void
  onClose: () => void
  initialQuery?: string
  initialWm?: number
  initialMode?: Mode
}) {
  const { ports } = useSeaPorts()
  const [aliases, setAliases] = useState<{ alias: string; port_code: string }[]>([])
  const [mode, setMode] = useState<Mode>(initialMode)
  const [ai, setAi] = useState(initialQuery)
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [loads, setLoads] = useState<Load[]>([{ size: '20', qty: 1 }])
  const [wm, setWm] = useState<string>(initialWm != null && initialWm > 0 ? String(initialWm) : '')
  const [cbm, setCbm] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [usingId, setUsingId] = useState<string | null>(null)
  const [results, setResults] = useState<RateOption[] | null>(null)
  const [lane, setLane] = useState<QuoteLane | null>(null)
  const [lclResults, setLclResults] = useState<LclRateOption[] | null>(null)
  const [lclLane, setLclLane] = useState<LclQuoteLane | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => { fetchPortAliases().then(setAliases).catch(() => {}) }, [])

  function resetResults() { setResults(null); setLane(null); setLclResults(null); setLclLane(null) }

  async function runFcl(l: QuoteLane, hint = '') {
    setBusy(true); setNote(hint); resetResults(); setLane(l)
    try { setResults(await searchFclRates(l)) }
    catch (e) { setResults([]); setNote(e instanceof Error ? e.message : 'Search failed') }
    finally { setBusy(false) }
  }

  async function runLcl(l: LclQuoteLane, hint = '') {
    setBusy(true); setNote(hint); resetResults(); setLclLane(l)
    try { setLclResults(await searchLclRates(l)) }
    catch (e) { setLclResults([]); setNote(e instanceof Error ? e.message : 'Search failed') }
    finally { setBusy(false) }
  }

  function wmNum(): number { return Math.max(0, Number(wm) || 0) }
  function cbmNum(): number { const c = Number(cbm) || 0; return c > 0 ? c : wmNum() }

  async function runAi() {
    const text = ai.trim()
    if (!text || busy) return
    const r = resolveRateQuery(text, ports.map((p) => ({ code: p.code, name: p.name })), aliases)
    if (!r.from || !r.to) {
      resetResults()
      setNote(!r.from && !r.to ? 'Name both ports, e.g. “Shanghai to Auckland”.' : !r.from ? 'Caught the destination but not the origin.' : 'Caught the origin but not the destination.')
      return
    }
    setOrigin(r.from.code); setDest(r.to.code)
    if (mode === 'lcl') {
      if (wmNum() <= 0) { resetResults(); setNote('Enter chargeable W/M for LCL, then search.'); return }
      await runLcl({ from_port_code: r.from.code, to_port_code: r.to.code, currency: null, wm: wmNum(), cbm: cbmNum() })
    } else {
      setLoads(r.containers)
      await runFcl({ from_port_code: r.from.code, to_port_code: r.to.code, currency: null, containers: r.containers }, r.assumedContainer ? 'Assumed 1×20ft — adjust loads if needed.' : '')
    }
  }

  async function runManual() {
    if (!origin || !dest) { setNote('Pick both origin and destination ports.'); return }
    if (busy) return
    if (mode === 'lcl') {
      if (wmNum() <= 0) { setNote('Enter chargeable W/M (revenue tonnes) for LCL.'); return }
      await runLcl({ from_port_code: origin, to_port_code: dest, currency: null, wm: wmNum(), cbm: cbmNum() })
    } else {
      await runFcl({ from_port_code: origin, to_port_code: dest, currency: null, containers: loads })
    }
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

  async function useLcl(o: LclRateOption) {
    if (!lclLane || usingId || !onUseLclRate) return
    setUsingId(o.cardId)
    try { await onUseLclRate(o, lclLane); onClose() }
    catch (e) { setNote(e instanceof Error ? e.message : 'Could not use that rate') }
    finally { setUsingId(null) }
  }

  const updLoad = (i: number, patch: Partial<Load>) => setLoads((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  function switchMode(m: Mode) { if (m === mode) return; setMode(m); resetResults(); setNote('') }

  const tabBtn = (m: Mode, label: string) => (
    <button type="button" onClick={() => switchMode(m)}
      style={{ flex: 1, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
        background: mode === m ? '#0A2472' : 'transparent', color: mode === m ? '#fff' : 'var(--muted-foreground)' }}>{label}</button>
  )

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 130, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflow: 'auto' }}>
      <div style={{ width: 'min(760px, 100%)', background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', color: '#fff', background: 'linear-gradient(120deg,#0A2472,#3B5BFE 55%,#F5A623 150%)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><Sparkles size={16} /> Find rates</div>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 8, padding: 4, cursor: 'pointer', display: 'inline-flex' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(10,36,114,0.06)', borderRadius: 10 }}>
            {tabBtn('fcl', 'Sea FCL')}
            {tabBtn('lcl', 'Sea LCL')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={ai} onChange={(e) => setAi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAi() }}
              placeholder={mode === 'lcl' ? 'Ask AI — e.g. “Ningbo to Auckland” (set W/M below)' : 'Ask AI — e.g. “Ningbo to Auckland, 2×40ft”'}
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
          {mode === 'fcl' ? (
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}>Cargo</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted-foreground)' }}>
                  Chargeable W/M (revenue tonnes)
                  <input className="input input--sm" type="number" min={0} inputMode="decimal" value={wm} onChange={(e) => setWm(e.target.value)} style={{ width: 160 }} placeholder="e.g. 3.5" />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted-foreground)' }}>
                  Volume CBM (optional)
                  <input className="input input--sm" type="number" min={0} inputMode="decimal" value={cbm} onChange={(e) => setCbm(e.target.value)} style={{ width: 160 }} placeholder="defaults to W/M" />
                </label>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>W/M = greater of total CBM and total weight in tonnes. CBM is only needed for per-CBM surcharges.</span>
              <button type="button" onClick={runManual} disabled={busy} className="btn btn--inline" style={{ marginTop: 4, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Search size={15} /> Search rates</button>
            </div>
          )}
          {note && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{note}</p>}
          {busy && <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Searching…</p>}
          {!busy && mode === 'fcl' && results && results.length === 0 && <p className="text-muted-foreground" style={{ fontSize: 13 }}>No matching rates. Check the lane or that a rate card is Validated/Active.</p>}
          {!busy && mode === 'lcl' && lclResults && lclResults.length === 0 && <p className="text-muted-foreground" style={{ fontSize: 13 }}>No matching LCL rates. Check the lane or that a rate card is Validated/Active.</p>}
          {!busy && mode === 'fcl' && results && results.length > 0 && lane && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((o) => (<RateOptionCard key={o.cardId} option={o} fromCode={lane.from_port_code!} toCode={lane.to_port_code!} onUse={() => use(o)} busy={usingId === o.cardId} />))}
            </div>
          )}
          {!busy && mode === 'lcl' && lclResults && lclResults.length > 0 && lclLane && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lclResults.map((o) => (<LclRateOptionCard key={o.cardId} option={o} fromCode={lclLane.from_port_code!} toCode={lclLane.to_port_code!} onUse={onUseLclRate ? () => useLcl(o) : undefined} busy={usingId === o.cardId} />))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
