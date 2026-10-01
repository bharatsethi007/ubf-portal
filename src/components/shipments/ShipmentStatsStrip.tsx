import { CountUp, Skeleton, Sparkline } from '../../pages/tower/towerUi'
import { C, TOWER_CSS } from '../../pages/tower/towerTheme'
import { useShipmentFilters } from '../../hooks/useShipmentFilters'
import { useShipmentStats, type StatBlock, type ShipmentStats } from '../../hooks/useShipmentStats'

type Key = keyof StatBlock
type Tile = { key: Key | 'next7'; label: string; fmt: (n: number) => string; series?: keyof ShipmentStats['series'] }

const int = (n: number) => Math.round(n).toLocaleString()
const kg = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)} t` : `${int(n)} kg`)
const cbm = (n: number) => `${n >= 100 ? int(n) : n.toFixed(1)} m³`

function tilesFor(module: string): Tile[] {
  const isExport = module === 'FEA' || module === 'FES'
  const isSea = module === 'FES' || module === 'FIS'
  const next: Tile = { key: 'next7', label: isExport ? 'Departing next 7 days' : 'Arriving next 7 days', fmt: int }
  const base: Tile[] = [
    { key: 'consols', label: 'Consols', fmt: int, series: 'consols' },
    { key: 'hbls', label: 'House bills', fmt: int, series: 'hbls' },
  ]
  if (isSea) {
    return [
      ...base,
      { key: 'teu', label: 'TEU', fmt: int },
      { key: 'volume_m3', label: 'Volume', fmt: cbm, series: 'volume_m3' },
      { key: 'weight_kg', label: 'Weight', fmt: kg, series: 'weight_kg' },
      next,
    ]
  }
  return [
    ...base,
    { key: 'weight_kg', label: 'Gross weight', fmt: kg, series: 'weight_kg' },
    { key: 'volume_m3', label: 'Volume', fmt: cbm, series: 'volume_m3' },
    { key: 'customers', label: 'Customers', fmt: int, series: 'customers' },
    next,
  ]
}

function delta(cur: number, prev: number): { text: string; bad: boolean } | null {
  if (!prev) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { text: `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`, bad: pct < 0 }
}

function subline(t: Tile, d: ShipmentStats): React.ReactNode {
  if (t.key === 'next7') return 'Not yet sailed'
  if (t.key === 'consols' && d.cur.consols) {
    return `${(d.cur.hbls / d.cur.consols).toFixed(1)} HBL per consol`
  }
  const dl = delta(d.cur[t.key], d.prev[t.key])
  if (!dl) return ' '
  return (
    <>
      <span className={dl.text === '0%' ? '' : dl.bad ? 'tw-dn' : 'tw-up'}>{dl.text}</span> vs prior period
    </>
  )
}

/** KPI strip for the Shipments page, styled like the Control Tower pulse strip. */
export default function ShipmentStatsStrip() {
  const { moduleCode } = useShipmentFilters()
  const { data, loading } = useShipmentStats()
  const tiles = tilesFor(moduleCode)

  return (
    <div className="tw-root" style={{ padding: 0, gap: 0 }}>
      <style>{TOWER_CSS}</style>
      <div className="tw-kpis">
        {tiles.map((t, i) => {
          if (loading && !data) {
            return (
              <div key={t.key} className="tw-card tw-kpi">
                <Skeleton w={90} h={12} />
                <Skeleton w={110} h={28} />
                <Skeleton h={24} />
              </div>
            )
          }
          const value = !data ? null : t.key === 'next7' ? data.next7 : data.cur[t.key]
          return (
            <div key={t.key} className="tw-card tw-kpi" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="tw-kpi__l">{t.label}</div>
              <CountUp className="tw-kpi__v" value={value} format={t.fmt} />
              <div className="tw-kpi__s">{data ? subline(t, data) : ' '}</div>
              {data && t.series ? <Sparkline data={data.series[t.series]} color={C.navy} /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
