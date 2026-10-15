import type { ColumnDef } from '@tanstack/react-table'
import type { QuoteRow } from './quotesTableColumns'

// Cargo summary per quote, built from the embedded cargo lines / containers.
export type QuoteLoad = {
  pieces: number | null
  chargeableKg: number | null
  cbm: number | null
  containers: number | null
  equipment: string | null // e.g. "1×20GP · 2×40HC"
}

type CargoRow = { quantity: number | null; total_cbm: number | null; chargeable_wt: number | null }
type ContainerRow = { container_size: string | null; container_type: string | null; qty: number | null }

const TYPE_SUFFIX: Record<string, string> = {
  reefer: 'RF', opentop: 'OT', flatrack: 'FR', isotank: 'TK', openside: 'OS',
}

// "20" + standard -> 20GP, "40HC" + standard -> 40HC, "40" + reefer -> 40RF.
function equipCode(size: string | null, type: string | null): string {
  const s = (size ?? '').toUpperCase()
  const base = s.replace('HC', '')
  const t = (type ?? 'standard').toLowerCase()
  if (TYPE_SUFFIX[t]) return `${base}${TYPE_SUFFIX[t]}`
  return s.includes('HC') ? `${base}HC` : `${base}GP`
}

const sum = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && !isNaN(Number(x))).map(Number)
  return v.length ? v.reduce((a, b) => a + b, 0) : null
}

export function summarizeLoad(cargo?: CargoRow[] | null, containers?: ContainerRow[] | null): QuoteLoad {
  const c = cargo ?? []
  const k = containers ?? []
  const byCode = new Map<string, number>()
  for (const r of k) {
    const code = equipCode(r.container_size, r.container_type)
    byCode.set(code, (byCode.get(code) ?? 0) + (Number(r.qty) || 0))
  }
  const equipment = byCode.size ? [...byCode].map(([code, n]) => `${n}×${code}`).join(' · ') : null
  return {
    pieces: sum(c.map((r) => r.quantity)),
    chargeableKg: sum(c.map((r) => r.chargeable_wt)),
    cbm: sum(c.map((r) => r.total_cbm)),
    containers: sum(k.map((r) => r.qty)),
    equipment,
  }
}

const muted = <span style={{ color: '#94a3b8' }}>—</span>
const num = (n: number | null, dp: number, unit = '') =>
  n == null ? muted : <span style={{ whiteSpace: 'nowrap' }}>{n.toLocaleString('en-NZ', { maximumFractionDigits: dp })}{unit}</span>

function kindOf(row: QuoteRow): 'air' | 'lcl' | 'fcl' | null {
  const m = (row.shipment_mode ?? '').toLowerCase()
  const t = (row.shipment_type ?? '').toUpperCase()
  if (m.includes('air') || t === 'AIR') return 'air'
  if (t === 'LCL') return 'lcl'
  if (t === 'FCL') return 'fcl'
  return null
}

// One-line load for the mixed "All" view, worded per mode.
function loadText(row: QuoteRow): string | null {
  const l = row.load
  if (!l) return null
  const pcs = l.pieces != null ? `${l.pieces} pcs` : null
  const k = kindOf(row)
  if (k === 'fcl') return l.equipment
  if (k === 'air') return [pcs, l.chargeableKg != null ? `${l.chargeableKg.toLocaleString('en-NZ')} kg ch` : null].filter(Boolean).join(' · ') || null
  if (k === 'lcl') return [pcs, l.cbm != null ? `${l.cbm.toLocaleString('en-NZ', { maximumFractionDigits: 2 })} cbm` : null].filter(Boolean).join(' · ') || null
  return null
}

export function loadColumns(mode: 'all' | 'air' | 'fcl' | 'lcl'): ColumnDef<QuoteRow>[] {
  if (mode === 'air') return [
    { id: 'pieces', header: 'Pcs', cell: ({ row }) => num(row.original.load?.pieces ?? null, 0) },
    { id: 'chargeable', header: 'Chargeable', cell: ({ row }) => num(row.original.load?.chargeableKg ?? null, 1, ' kg') },
  ]
  if (mode === 'lcl') return [
    { id: 'pieces', header: 'Pcs', cell: ({ row }) => num(row.original.load?.pieces ?? null, 0) },
    { id: 'cbm', header: 'CBM', cell: ({ row }) => num(row.original.load?.cbm ?? null, 2) },
  ]
  if (mode === 'fcl') return [
    { id: 'containers', header: 'Containers', cell: ({ row }) => num(row.original.load?.containers ?? null, 0) },
    { id: 'equipment', header: 'Type', cell: ({ row }) => row.original.load?.equipment ?? muted },
  ]
  return [{
    id: 'load', header: 'Load',
    cell: ({ row }) => { const t = loadText(row.original); return t ? <span style={{ whiteSpace: 'nowrap' }}>{t}</span> : muted },
  }]
}
