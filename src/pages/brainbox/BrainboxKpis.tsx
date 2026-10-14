import { useEffect, useState } from 'react'
import { fetchChargeStats, fetchKpis, type Kpis } from './brainboxApi'
import { GROUP_META, GROUP_ORDER, SOURCE_GROUP, type SourceGroup } from './sourceMeta'

type Props = { days: number; mode: string | null }

/** Four headline numbers over the chosen period. Legacy (untracked) lines are left out of the split. */
export default function BrainboxKpis({ days, mode }: Props) {
  const [k, setK] = useState<Kpis | null>(null)
  const [ready, setReady] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    setK(null)
    fetchKpis(days, mode).then((d) => { if (live) setK(d) }).catch(() => {})
    fetchChargeStats(days, mode)
      .then((s) => { if (live) setReady(s.filter((x) => x.pattern === 'fixed' && x.unit_class === 'flat' && x.mode_val >= 1 && x.charge_code && !x.rule_id).length) })
      .catch(() => {})
    return () => { live = false }
  }, [days, mode])

  const byGroup = new Map<SourceGroup, number>()
  for (const [src, v] of Object.entries(k?.sources ?? {})) {
    const g = SOURCE_GROUP[src] ?? 'manual'
    if (g === 'legacy') continue
    byGroup.set(g, (byGroup.get(g) ?? 0) + Number(v))
  }
  const tracked = [...byGroup.values()].reduce((a, b) => a + b, 0)
  const cardPct = tracked > 0 ? Math.round(((byGroup.get('card') ?? 0) / tracked) * 100) : null
  const editPct = k && k.card_lines > 0 ? Math.round((k.card_edited / k.card_lines) * 100) : null
  const since = k?.tracking_since ? new Date(k.tracking_since).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : null

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Sell priced from cards" big={cardPct == null ? '-' : `${cardPct}%`}
        sub={tracked > 0 ? 'card · cartage · rule · manual' : since ? `Tracking since ${since}` : 'Tracking starts with the next quote'}>
        {tracked > 0 && (
          <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded">
            {GROUP_ORDER.filter((g) => (byGroup.get(g) ?? 0) > 0).map((g) => (
              <div key={g} title={`${GROUP_META[g].label} ${Math.round(((byGroup.get(g) ?? 0) / tracked) * 100)}%`}
                style={{ width: `${((byGroup.get(g) ?? 0) / tracked) * 100}%`, background: GROUP_META[g].bar }} />
            ))}
          </div>
        )}
      </Tile>
      <Tile label="Card lines edited before send" big={editPct == null ? '-' : `${editPct}%`}
        sub={k?.card_edit_avg_pct != null ? `avg sell change ${k.card_edit_avg_pct > 0 ? '+' : ''}${k.card_edit_avg_pct}%` : `${k?.card_lines ?? 0} card lines so far`} />
      <Tile label="Charges quoted with no card" big={k ? String(k.manual_charges) : '-'}
        sub={k ? `${k.uncoded} wording${k.uncoded === 1 ? '' : 's'} not yet coded` : ''} />
      <Tile tone="good" label="Ready to become rules" big={ready == null ? '-' : String(ready)} sub="same price on 90%+ of 10+ quotes" />
    </div>
  )
}

function Tile({ label, big, sub, tone, children }: { label: string; big: string; sub: string; tone?: 'good'; children?: React.ReactNode }) {
  const good = tone === 'good'
  return (
    <div className={`rounded-lg border bg-white px-4 py-3 ${good ? 'border-[#CFE6DA] text-[#0F5E3D]' : 'border-[#E3E7EF]'}`}>
      <div className={`text-xs ${good ? '' : 'text-[#5B6577]'}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold">{big}</div>
      {children}
      <div className={`mt-1.5 text-[11px] ${good ? '' : 'text-[#5B6577]'}`}>{sub}</div>
    </div>
  )
}
