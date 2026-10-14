import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { fetchChargeStats, suggestRule, type ChargeStat, type Pattern } from './brainboxApi'
import { money } from './sourceMeta'

type Props = { days: number; mode: string | null; onRuleSuggested: () => void }

const TAG: Record<Pattern, { text: string; bg: string; fg: string }> = {
  fixed: { text: 'Same every time', bg: '#E3F3EA', fg: '#0F5E3D' },
  mostly: { text: 'Mostly same', bg: '#E7EBF7', fg: '#0A2472' },
  varies: { text: 'Varies', bg: '#FDEFE4', fg: '#8A4A17' },
  percent: { text: 'Percent based', bg: '#EEF1F5', fg: '#3D4757' },
}

function reads(s: ChargeStat): string {
  const share = Math.round(s.mode_share * 100)
  if (s.pattern === 'percent') return 'Quoted as a %, check what it is a % of'
  if (s.pattern === 'fixed') return `${s.currency} ${money(s.mode_val)} on ${share}% of quotes`
  if (s.pattern === 'mostly') return `Usually ${money(s.mode_val)}, ${share}% of quotes`
  return `Range ${money(s.mn)} to ${money(s.mx)}, split by lane or customer to check`
}

/** Charges the team prices by hand (no rate card), most used first. */
export default function BrainboxLibrary({ days, mode, onRuleSuggested }: Props) {
  const [rows, setRows] = useState<ChargeStat[] | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setRows(null)
    fetchChargeStats(days, mode).then((d) => { if (live) setRows(d) }).catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [days, mode, tick])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? [])
      .filter((s) => s.n_quotes >= 2)
      .filter((s) => !needle || s.label.toLowerCase().includes(needle) || (s.charge_code ?? '').toLowerCase().includes(needle))
      .sort((a, b) => b.n_quotes - a.n_quotes)
  }, [rows, q])

  const make = async (s: ChargeStat) => {
    setBusy(`${s.key}|${s.currency}|${s.unit_class}`)
    try {
      await suggestRule(s.key, s.currency, s.unit_class)
      toast.success(`${s.label} rule suggested. Approve it under Rules.`)
      onRuleSuggested()
      setTick((t) => t + 1)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not suggest rule') } finally { setBusy(null) }
  }

  return (
    <section className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          Charge library <span className="ml-2 text-xs font-normal text-[#5B6577]">what the team charges, freight left out, most used first</span>
        </h2>
        <input className="input input--sm" style={{ width: 240 }} placeholder="Search charge or code" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search charges" />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Charge</th><th style={{ textAlign: 'right' }}>Quotes</th><th style={{ textAlign: 'right' }}>Median</th>
              <th style={{ minWidth: 200 }}>Spread</th><th>Pattern</th><th>Brainbox reads</th><th />
            </tr>
          </thead>
          <tbody>
            {rows == null && <tr><td colSpan={7} className="text-muted-foreground pad-inline">Loading…</td></tr>}
            {rows != null && list.length === 0 && <tr><td colSpan={7} className="text-muted-foreground pad-inline">No charges in this period.</td></tr>}
            {list.map((s) => {
              const scale = s.mx * 1.1 || 1
              const tag = TAG[s.pattern]
              const id = `${s.key}|${s.currency}|${s.unit_class}`
              const canRule = !!s.charge_code && (s.pattern === 'percent' || ((s.pattern === 'fixed' || s.pattern === 'mostly') && s.unit_class === 'flat' && s.mode_val >= 1))
              return (
                <tr key={id}>
                  <td>
                    <div>{s.label}</div>
                    <div className="text-[11px] text-[#8A93A5]">{s.charge_code ?? 'Not coded'} · {s.currency} · {s.unit_class.replace('_', ' ')}</div>
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{s.n_quotes}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{money(s.med)}</td>
                  <td>
                    <div className="flex items-center gap-2" title={`min ${money(s.mn)} · median ${money(s.med)} · max ${money(s.mx)}`}>
                      <div className="relative h-1.5 flex-1 rounded bg-[#EEF1F6]">
                        <div className="absolute inset-y-0 rounded bg-[#C7D1EE]"
                          style={{ left: `${(s.mn / scale) * 100}%`, width: `${Math.max(((s.mx - s.mn) / scale) * 100, 1.5)}%` }} />
                        <div className="absolute -top-1 h-3.5 w-0.5 bg-[#0A2472]" style={{ left: `${(s.med / scale) * 100}%` }} />
                      </div>
                      <span className="w-24 text-right font-mono text-[11px] text-[#5B6577]">{s.mn === s.mx ? 'fixed' : `${money(s.mn, 0)} to ${money(s.mx, 0)}`}</span>
                    </div>
                  </td>
                  <td><span className="rounded px-2 py-0.5 text-[11px]" style={{ background: tag.bg, color: tag.fg }}>{tag.text}</span></td>
                  <td className="text-xs text-[#5B6577]">{reads(s)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {s.rule_status
                      ? <span className="text-xs text-[#0F5E3D]">{s.rule_status === 'active' ? 'Rule active' : 'Rule suggested'}</span>
                      : canRule && (
                        <button type="button" className="btn h-8 border border-[#2F4FD8] bg-white px-3 text-xs text-[#2F4FD8]"
                          disabled={busy === id} onClick={() => void make(s)}>
                          {s.pattern === 'percent' ? 'Make % note' : 'Make rule'}
                        </button>
                      )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
