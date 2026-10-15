/** Canvas drawing for the Brainbox neural view. Pure functions, no React. */

export type Graph = {
  lanes: GNode[]; charges: GNode[]; payers: GNode[]
  e1: { a: string; b: string; n: number }[]; e2: { a: string; b: string; n: number }[]
}
export type GNode = { id: string; label: string; n: number }
export type Layer = 'l' | 'c' | 'p'
export type Node = GNode & { k: Layer; x: number; y: number; r: number }
export type Edge = { a: Node; b: Node; n: number }
type Pulse = { e: Edge; t: number; v: number }

export const COLOR: Record<Layer, string> = { l: '#0A2472', c: '#0F7A6E', p: '#D86F22' }
const TEXT = '#141B2D'
const MUTED = '#8A93A5'

export function buildLayout(g: Graph, W: number, H: number): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const col = (arr: GNode[], k: Layer, x: number) => arr.forEach((a, i) => nodes.push({
    ...a, k, x, y: 28 + ((H - 56) * (i + 0.5)) / arr.length, r: 4 + Math.sqrt(a.n) / 8,
  }))
  col(g.lanes, 'l', W * 0.17)
  col(g.charges, 'c', W * 0.5)
  col(g.payers, 'p', W * 0.83)
  const find = (k: Layer, id: string) => nodes.find((n) => n.k === k && n.id === id)
  const edges: Edge[] = []
  for (const e of g.e1) { const a = find('l', e.a), b = find('c', e.b); if (a && b) edges.push({ a, b, n: e.n }) }
  for (const e of g.e2) { const a = find('c', e.a), b = find('p', e.b); if (a && b) edges.push({ a, b, n: e.n }) }
  return { nodes, edges }
}

export const touches = (e: Edge, n: Node | null) => !n || e.a === n || e.b === n

function bez(e: Edge, t: number): [number, number] {
  const mx = (e.a.x + e.b.x) / 2, u = 1 - t
  return [
    u * u * u * e.a.x + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * e.b.x,
    u * u * u * e.a.y + 3 * u * u * t * e.a.y + 3 * u * t * t * e.b.y + t * t * t * e.b.y,
  ]
}

/** Slow by design: few pulses, long travel time. */
export function makeAnimator(ctx: CanvasRenderingContext2D) {
  let pulses: Pulse[] = []
  return function frame(W: number, H: number, nodes: Node[], edges: Edge[], focus: Node | null, animate: boolean) {
    ctx.clearRect(0, 0, W, H)
    for (const e of edges) {
      const lit = touches(e, focus)
      ctx.globalAlpha = focus ? (lit ? 0.5 : 0.035) : 0.12
      ctx.strokeStyle = focus && lit ? COLOR[e.a.k] : MUTED
      ctx.lineWidth = 0.4 + Math.log10(e.n) * 0.9
      const mx = (e.a.x + e.b.x) / 2
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.bezierCurveTo(mx, e.a.y, mx, e.b.y, e.b.x, e.b.y); ctx.stroke()
    }
    ctx.globalAlpha = 1
    if (animate) {
      for (const e of edges) {
        if (Math.random() < Math.min(0.012, e.n / 60000)) pulses.push({ e, t: 0, v: 0.0012 + Math.log10(e.n) * 0.0008 })
      }
      pulses = pulses.filter((p) => {
        p.t += p.v
        if (p.t >= 1) return false
        if (!touches(p.e, focus)) return true
        const [px, py] = bez(p.e, p.t)
        ctx.globalAlpha = Math.sin(p.t * Math.PI) * 0.9
        ctx.fillStyle = COLOR[p.e.a.k]
        ctx.beginPath(); ctx.arc(px, py, 1.5 + Math.log10(p.e.n) * 0.45, 0, 7); ctx.fill()
        return true
      })
      ctx.globalAlpha = 1
    }
    ctx.font = '12px "General Sans", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    for (const n of nodes) {
      const dim = !!focus && n !== focus && !edges.some((e) => (e.a === focus && e.b === n) || (e.b === focus && e.a === n))
      ctx.globalAlpha = dim ? 0.18 : 1
      ctx.fillStyle = COLOR[n.k]
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill()
      if (n === focus) { ctx.strokeStyle = COLOR[n.k]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, 7); ctx.stroke() }
      ctx.fillStyle = dim ? MUTED : TEXT
      if (n.k === 'l') { ctx.textAlign = 'right'; ctx.fillText(n.label, n.x - n.r - 7, n.y) }
      else if (n.k === 'p') { ctx.textAlign = 'left'; ctx.fillText(n.label, n.x + n.r + 7, n.y) }
      else { ctx.textAlign = 'center'; ctx.fillText(n.label, n.x, n.y - n.r - 9) }
    }
    ctx.globalAlpha = 1
  }
}
