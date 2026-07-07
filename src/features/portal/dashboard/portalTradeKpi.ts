import type { PortalShipmentRow } from './portalDashboardApi'
import { shipmentDirection } from './portalStatus'

export type PortalContainerRow = {
  id: number
  consol_key: string | null
  c_number: string | null
  container_size: '20' | '40' | '40HC' | null
}

export type TradeModeMetrics = {
  air: { count: number; totalWeightKg: number }
  sea: { count: number; totalCbm: number }
  seaLcl: { count: number; totalCbm: number }
  seaFcl: {
    jobCount: number
    containers20: number
    containers40: number
    containers40Hc: number
  }
}

export type TradeKpiMetrics = {
  seaSplitAvailable: boolean
  imports: TradeModeMetrics
  exports: TradeModeMetrics
}

function emptyMode(): TradeModeMetrics {
  return {
    air: { count: 0, totalWeightKg: 0 },
    sea: { count: 0, totalCbm: 0 },
    seaLcl: { count: 0, totalCbm: 0 },
    seaFcl: { jobCount: 0, containers20: 0, containers40: 0, containers40Hc: 0 },
  }
}

export function createEmptyTradeKpis(): TradeKpiMetrics {
  return { seaSplitAvailable: false, imports: emptyMode(), exports: emptyMode() }
}

function isSeaFcl(row: PortalShipmentRow): boolean {
  return row.load_type === 'FCL'
}

function isSeaLcl(row: PortalShipmentRow): boolean {
  return row.load_type === 'LCL'
}

/**
 * Sea LCL/FCL uses shipments.load_type synced from FIS_JOB.FCL / FES_JOB.FCL.
 * Consol container presence is NOT used — LCL cargo shares consol containers.
 * FCL container sizes (20/40/40HC) count at consol grain for customer FCL jobs.
 */
export function buildTradeKpis(
  rows: PortalShipmentRow[],
  containers: PortalContainerRow[],
): TradeKpiMetrics {
  const result = createEmptyTradeKpis()
  const seaSplitAvailable = rows.some((r) => r.mode === 'sea' && r.load_type != null)
  result.seaSplitAvailable = seaSplitAvailable

  const fclConsolsByDir: Record<'import' | 'export', Set<string>> = {
    import: new Set(),
    export: new Set(),
  }

  for (const row of rows) {
    const dir = shipmentDirection(row)
    const bucket = dir === 'export' ? result.exports : result.imports

    if (row.mode === 'air') {
      bucket.air.count += 1
      bucket.air.totalWeightKg += row.weight_kg ?? 0
      continue
    }

    if (row.mode !== 'sea') continue

    bucket.sea.count += 1
    bucket.sea.totalCbm += row.volume_m3 ?? 0

    if (!seaSplitAvailable) continue

    if (isSeaFcl(row)) {
      bucket.seaFcl.jobCount += 1
      if (row.consol_key) fclConsolsByDir[dir].add(row.consol_key)
    } else if (isSeaLcl(row)) {
      bucket.seaLcl.count += 1
      bucket.seaLcl.totalCbm += row.volume_m3 ?? 0
    }
  }

  if (!seaSplitAvailable) return result

  const seenByConsol = new Map<string, Set<number>>()
  for (const c of containers) {
    if (!c.consol_key) continue
    let seen = seenByConsol.get(c.consol_key)
    if (!seen) {
      seen = new Set()
      seenByConsol.set(c.consol_key, seen)
    }
    if (seen.has(c.id)) continue
    seen.add(c.id)

    for (const dir of ['import', 'export'] as const) {
      if (!fclConsolsByDir[dir].has(c.consol_key)) continue
      const bucket = dir === 'export' ? result.exports : result.imports
      if (c.container_size === '20') bucket.seaFcl.containers20 += 1
      else if (c.container_size === '40') bucket.seaFcl.containers40 += 1
      else if (c.container_size === '40HC') bucket.seaFcl.containers40Hc += 1
    }
  }

  return result
}
