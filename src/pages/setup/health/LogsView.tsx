import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import LogHistogram from './LogHistogram'
import LogStream from './LogStream'
import {
  fetchHistogram, fetchLogs, type Histogram, type Level, type LogFilter, type LogRow, RANGES, type RangeKey,
  sourceMeta, useProviders,
} from './logsApi'

type Zoom = { from: Date; to: Date } | null
const LEVELS: Level[] = ['info', 'warn', 'error']
const PAGE = 200

function fmtRange(z: NonNullable<Zoom>) {
  const o: Intl.DateTimeFormatOptions = { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
  return `${z.from.toLocaleString('en-NZ', o)} → ${z.to.toLocaleString('en-NZ', o)}`
}

export default function LogsView({ initialSource }: { initialSource?: string | null }) {
  const providers = useProviders()
  const [range, setRange] = useState<RangeKey>('24h')
  const [zoom, setZoom] = useState<Zoom>(null)
  const [sources, setSources] = useState<string[]>(initialSource ? [initialSource] : [])
  const [levels, setLevels] = useState<Level[]>([])
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [live, setLive] = useState(false)
  const [rows, setRows] = useState<LogRow[]>([])
  const [hist, setHist] = useState<Histogram | null>(null)
  const [loading, setLoading] = useState(true)
  const [canMore, setCanMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const seen = useRef<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (initialSource) setSources([initialSource]) }, [initialSource])
  useEffect(() => { const t = window.setTimeout(() => setQ(qInput), 300); return () => window.clearTimeout(t) }, [qInput])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const filter = useCallback((): LogFilter => {
    const to = zoom ? zoom.to : new Date()
    const from = zoom ? zoom.from : new Date(to.getTime() - RANGES.find((r) => r.key === range)!.ms)
    return { from, to, sources, levels, q }
  }, [zoom, range, sources, levels, q])

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const f = filter()
      const [l, h] = await Promise.all([fetchLogs(f, undefined, PAGE), fetchHistogram(f)])
      const isFirst = seen.current.size === 0
      const nu = new Set(l.filter((r) => !seen.current.has(r.id)).map((r) => r.id))
      l.forEach((r) => seen.current.add(r.id))
      setFresh(isFirst || !quiet ? new Set() : nu)
      setRows(l); setHist(h); setCanMore(l.length === PAGE); setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { seen.current = new Set(); load() }, [load])
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => load(true), 5000)
    return () => window.clearInterval(id)
  }, [live, load])

  const more = async () => {
    if (!rows.length) return
    setLoading(true)
    try {
      const older = await fetchLogs(filter(), rows[rows.length - 1].ts, PAGE)
      setRows((r) => [...r, ...older.filter((x) => !r.some((y) => y.id === x.id))])
      setCanMore(older.length === PAGE)
    } finally { setLoading(false) }
  }

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const srcList = hist?.sources ?? []
  const allSrcTotal = srcList.reduce((a, s) => a + s.n, 0)

  return (
    <div className="bs-logs">
      <aside className="bs-panel bs-sources">
        <div className="bs-sec" style={{ padding: '4px 8px 6px' }}>Sources</div>
        <button type="button" className="bs-srow" aria-pressed={!sources.length} onClick={() => setSources([])}>
          All sources<span className="n">{allSrcTotal.toLocaleString()}</span>
        </button>
        {srcList.map((s) => {
          const m = sourceMeta(s.source, providers)
          return (
            <button key={s.source} type="button" className="bs-srow" aria-pressed={sources.includes(s.source)}
              onClick={() => setSources((x) => toggle(x, s.source))}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: m.colour, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              {s.err > 0 && <span className="e">{s.err}</span>}
              <span className="n">{s.n.toLocaleString()}</span>
            </button>
          )
        })}
        {!srcList.length && !loading && <div style={{ padding: 8, color: 'var(--faint)', fontSize: 12 }}>No events in range</div>}
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="bs-search">
            <Search size={14} color="var(--faint)" />
            <input ref={searchRef} value={qInput} onChange={(e) => setQInput(e.target.value)}
              placeholder="Search messages, functions, paths…  e.g. portconnect, 404, booking-email-ingest" aria-label="Search logs" />
            {qInput ? <button type="button" className="bs-btn bs-ib" style={{ height: 22, width: 22, border: 0 }} onClick={() => setQInput('')} aria-label="Clear search"><X size={13} /></button>
              : <span className="bs-kbd">/</span>}
          </label>
          <div className="bs-seg" role="group" aria-label="Level">
            {LEVELS.map((l) => (
              <button key={l} type="button" aria-pressed={levels.includes(l)} onClick={() => setLevels((x) => toggle(x, l))}>
                <span className={`bs-dot bs-dot--${l === 'info' ? 'idle' : l === 'warn' ? 'warn' : 'bad'}`} style={{ marginRight: 6, background: l === 'info' ? '#A5B4FC' : undefined }} />
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
          {zoom ? (
            <span className="bs-chip bs-mono">{fmtRange(zoom)}<button type="button" onClick={() => setZoom(null)} aria-label="Clear zoom"><X size={12} /></button></span>
          ) : (
            <div className="bs-seg" role="group" aria-label="Time range">
              {RANGES.map((r) => <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>)}
            </div>
          )}
          <button type="button" className="bs-btn bs-live" aria-pressed={live} onClick={() => { setZoom(null); setLive((v) => !v) }}
            title="Refresh every 5 seconds">
            <span className={`bs-dot ${live ? 'bs-dot--ok bs-dot--pulse' : 'bs-dot--idle'}`} />Live tail
          </button>
        </div>

        {error && <div className="sh-banner sh-banner--bad">{error}</div>}

        <div className="bs-panel">
          <LogHistogram hist={hist} onZoom={(from, to) => { setLive(false); setZoom({ from, to }) }} />
        </div>

        <div className="bs-panel" style={{ overflow: 'hidden' }}>
          <div className="bs-line" style={{ cursor: 'default', background: '#FAFAFB', fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: 'var(--faint)' }}>
            <span /><span>Time (NZ)</span><span>Level</span><span>Source</span><span>Message</span>
          </div>
          <LogStream rows={rows} providers={providers} fresh={fresh} loading={loading} onMore={more} canMore={canMore} />
        </div>
      </div>
    </div>
  )
}
