import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, X } from 'lucide-react'
import { supabase } from '../../supabase'
import { COLOR, buildLayout, makeAnimator, type Edge, type Graph, type Node } from './neuralCanvas'

const MONTHS = [3, 6, 12]
const LAYER_NAME = { l: 'Lane', c: 'Charge', p: 'Payer' } as const

/**
 * Brainbox drawn like a neural network: lanes (input) -> charges (hidden) -> payers (output),
 * weighted by jobs billed in TradeWindow. Click a neuron to trace what feeds it and where it goes.
 */
export default function NeuralView() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [months, setMonths] = useState(6)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hover, setHover] = useState<Node | null>(null)
  const [pinned, setPinned] = useState<Node | null>(null)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [running, setRunning] = useState(!reduce)
  const [size, setSize] = useState({ w: 900, h: 520 })
  const layout = useMemo(() => (graph ? buildLayout(graph, size.w, size.h) : { nodes: [] as Node[], edges: [] as Edge[] }), [graph, size])
  const focus = pinned ?? hover

  useEffect(() => {
    setGraph(null); setPinned(null); setErr(null)
    supabase.rpc('brainbox_neural_graph', { p_months: months })
      .then(({ data, error }) => { if (error) setErr(error.message); else setGraph(data as Graph) })
  }, [months])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: 520 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Draw loop. Refs keep the loop stable while focus and running change.
  const live = useRef({ focus, running, layout, size })
  live.current = { focus, running, layout, size }
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const frame = makeAnimator(ctx)
    let raf = 0
    const tick = () => {
      const { focus: f, running: r, layout: l, size: s } = live.current
      const dpr = window.devicePixelRatio || 1
      if (c.width !== s.w * dpr) { c.width = s.w * dpr; c.height = s.h * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      frame(s.w, s.h, l.nodes, l.edges, f, r)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const hit = (ev: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    const mx = ev.clientX - r.left, my = ev.clientY - r.top
    return layout.nodes.find((n) => Math.hypot(n.x - mx, n.y - my) < n.r + 8) ?? null
  }

  const trace = useMemo(() => {
    if (!pinned) return null
    const ins = layout.edges.filter((e) => e.b === pinned).sort((a, b) => b.n - a.n)
    const outs = layout.edges.filter((e) => e.a === pinned).sort((a, b) => b.n - a.n)
    const sum = (es: Edge[]) => es.reduce((s, e) => s + e.n, 0) || 1
    return { ins, outs, inSum: sum(ins), outSum: sum(outs) }
  }, [pinned, layout])

  return (
    <section className="mt-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-xs text-[#6B7486]">
          {(['l', 'c', 'p'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[k] }} />
              {k === 'l' ? 'Input · lanes' : k === 'c' ? 'Hidden · charges' : 'Output · who pays'}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRunning(!running)} aria-label={running ? 'Pause' : 'Play'} title={running ? 'Pause' : 'Play'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6E9F0] text-[#3D4757] hover:bg-[#F7F8FC]">
            {running ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <select className="input input--sm" style={{ width: 'auto' }} aria-label="Period" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {MONTHS.map((m) => <option key={m} value={m}>Last {m} months</option>)}
          </select>
        </div>
      </div>

      <div className="relative rounded-xl border border-[#E6E9F0] bg-white" ref={wrap}>
        {err && <div className="p-4 text-sm text-[#8A4A17]">{err}</div>}
        {!graph && !err && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#6B7486]">Reading six months of billing…</div>}
        <canvas ref={canvas} role="img" aria-label="Lanes connect to charges, charges connect to payers, line weight is jobs billed"
          style={{ width: size.w, height: size.h, display: 'block', cursor: hover ? 'pointer' : 'default' }}
          onMouseMove={(e) => setHover(hit(e))} onMouseLeave={() => setHover(null)}
          onClick={(e) => { const n = hit(e); setPinned(n && n !== pinned ? n : null) }} />

        {trace && pinned && (
          <div className="absolute right-3 top-3 w-[280px] rounded-xl border border-[#E6E9F0] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#6B7486]">{LAYER_NAME[pinned.k]} trace</div>
                <div className="text-sm font-medium">{pinned.label}</div>
                <div className="text-xs text-[#6B7486]">{pinned.n.toLocaleString()} jobs</div>
              </div>
              <button type="button" aria-label="Close trace" onClick={() => setPinned(null)} className="h-7 w-7 rounded-md text-[#8A93A5] hover:bg-[#F3F4F7]">
                <X size={14} className="mx-auto" />
              </button>
            </div>
            <TraceList title="Fed by" edges={trace.ins} side="a" total={trace.inSum} />
            <TraceList title="Flows to" edges={trace.outs} side="b" total={trace.outSum} />
          </div>
        )}
      </div>
      <div className="text-xs text-[#6B7486]">
        {hover && !pinned ? `${hover.label} · ${hover.n.toLocaleString()} jobs. Click to trace.` : 'Line weight and pulse speed follow jobs billed. Click a neuron to trace it.'}
      </div>
    </section>
  )
}

function TraceList({ title, edges, side, total }: { title: string; edges: Edge[]; side: 'a' | 'b'; total: number }) {
  if (edges.length === 0) return null
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[#6B7486]">{title}</div>
      {edges.slice(0, 5).map((e) => {
        const n = e[side], pct = Math.round((e.n / total) * 100)
        return (
          <div key={n.id} className="mb-1.5">
            <div className="flex justify-between gap-2 text-xs"><span className="truncate">{n.label}</span><span className="shrink-0 text-[#6B7486]">{pct}%</span></div>
            <div className="mt-0.5 h-1 rounded bg-[#EEF1F6]"><div className="h-1 rounded" style={{ width: `${pct}%`, background: COLOR[n.k] }} /></div>
          </div>
        )
      })}
    </div>
  )
}
