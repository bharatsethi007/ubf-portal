import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CONTAINERS, computeSell, fmtDate, laneKey, money, type Line, type Product, type Rule } from './rateCardModel'
import { findCandidates, type Candidate } from './rateCardsApi'

type Props = { product: Product; rules: Partial<Record<Product, Rule>>; existing: Set<string>; nextSort: number; blank: (p: Product, sort: number) => Line; onLines: (l: Line[]) => void }

const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 text-[11.5px] ${on ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-[#E6E8EE] bg-white text-[#334155]'}`

/** Search every valid carrier rate (Setup > Rate cards), pick the ports to show, cheapest per lane ticked. */
export default function CarrierRatesPicker({ product: p, rules, existing, nextSort, blank, onLines }: Props) {
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [ctr, setCtr] = useState('')
  const [rows, setRows] = useState<Candidate[] | null>(null)
  const [origins, setOrigins] = useState<Set<string>>(new Set())
  const [dests, setDests] = useState<Set<string>>(new Set())
  const [card, setCard] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => { setRows(null); setSel(new Set()); setOrigins(new Set()); setDests(new Set()); setCard('') }, [p])

  async function search() {
    setBusy(true)
    try {
      const r = await findCandidates(p, origin.trim(), dest.trim(), p === 'FCL' ? ctr : '')
      setRows(r); setSel(new Set()); setCard('')
      setOrigins(new Set()); setDests(new Set())
      if (!r.length) toast.message('No valid carrier rates for that search')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Search failed') } finally { setBusy(false) }
  }

  const all = rows ?? []
  const tally = (k: 'origin_code' | 'dest_code') => { const m = new Map<string, number>(); for (const c of all) m.set(c[k], (m.get(c[k]) ?? 0) + 1); return [...m.entries()].sort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const oList = useMemo(() => tally('origin_code'), [rows])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dList = useMemo(() => tally('dest_code'), [rows])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cards = useMemo(() => [...new Map(all.map((c) => [c.card_id, `${c.vendor ? `${c.vendor} · ` : ''}${c.card_title}`])).entries()], [rows])
  const shown = all.filter((c) => (!origins.size || origins.has(c.origin_code)) && (!dests.size || dests.has(c.dest_code)) && (!card || c.card_id === card))
  const key = (c: Candidate) => laneKey({ product: p, origin_code: c.origin_code, dest_code: c.dest_code, container_type: c.container_type })

  function cheapest() {
    const best = new Map<string, Candidate>()
    for (const c of shown) { if (existing.has(key(c))) continue; const k = key(c); if (!best.has(k) || Number(c.buy) < Number(best.get(k)!.buy)) best.set(k, c) }
    setSel(new Set([...best.values()].map((c) => c.line_id)))
  }

  useEffect(() => {
    const chosen = all.filter((c) => sel.has(c.line_id))
    onLines(chosen.map((c, i) => {
      const base: Line = { ...blank(p, nextSort + i), origin_code: c.origin_code, dest_code: c.dest_code, container_type: c.container_type,
        transit_days: c.transit_days, via: c.via, frequency: c.frequency, source_table: c.source_table, source_line_id: c.line_id,
        source_card_id: c.card_id, buy: Number(c.buy), buy_currency: c.currency, sell_currency: c.currency ?? 'USD', origin_currency: c.currency ?? 'USD', carrier: c.vendor }
      return { ...base, freight_sell: computeSell(base, rules[p] ?? null) }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, rows])

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => { const x = new Set(set); if (x.has(v)) x.delete(v); else x.add(v); fn(x) }
  const lbl = 'text-[11.5px] text-[#5B6474]'

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3">
        <label className="flex flex-col gap-1"><span className={lbl}>Origin (blank = all)</span><input className="input" value={origin} placeholder={p === 'AIR' ? 'PVG' : 'CNSHA'} onChange={(e) => setOrigin(e.target.value)} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Destination (blank = all)</span><input className="input" value={dest} placeholder={p === 'AIR' ? 'AKL' : 'NZAKL'} onChange={(e) => setDest(e.target.value)} /></label>
        {p === 'FCL'
          ? <label className="flex flex-col gap-1"><span className={lbl}>Container</span><select className="input" value={ctr} onChange={(e) => setCtr(e.target.value)}><option value="">All</option>{CONTAINERS.map((c) => <option key={c}>{c}</option>)}</select></label>
          : <span />}
        <Button type="button" disabled={busy} onClick={() => void search()}><Search size={14} /> {busy ? 'Searching…' : 'Search valid rates'}</Button>
      </div>

      {rows && rows.length > 0 && (<>
        <div className="flex flex-col gap-2 rounded-lg bg-[#F8FAFF] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5"><span className={`${lbl} w-[86px]`}>From ports</span>
            {oList.map(([o, n]) => <button key={o} type="button" className={chip(origins.has(o))} onClick={() => toggle(origins, o, setOrigins)}>{o} <span className="opacity-70">{n}</span></button>)}
            {origins.size > 0 && <button type="button" className="text-[11.5px] text-[#0A2472]" onClick={() => setOrigins(new Set())}>All</button>}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className={`${lbl} w-[86px]`}>To ports</span>
            {dList.map(([d, n]) => <button key={d} type="button" className={chip(dests.has(d))} onClick={() => toggle(dests, d, setDests)}>{d} <span className="opacity-70">{n}</span></button>)}
            {dests.size > 0 && <button type="button" className="text-[11.5px] text-[#0A2472]" onClick={() => setDests(new Set())}>All</button>}</div>
          <div className="flex flex-wrap items-center gap-2"><span className={`${lbl} w-[86px]`}>Carrier card</span>
            <select className="h-7 max-w-[420px] rounded-md border border-[#E6E8EE] bg-white px-2 text-[12px]" value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="">All valid cards ({cards.length})</option>{cards.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select>
            <span className="flex-1" />
            <button type="button" className="btn btn--inline" onClick={cheapest}>Tick cheapest per lane</button>
            <button type="button" className="btn btn--inline" onClick={() => setSel(new Set(shown.filter((c) => !existing.has(key(c))).map((c) => c.line_id)))}>Tick all shown</button>
            <button type="button" className="text-[12px] text-[#5B6474]" onClick={() => setSel(new Set())}>Clear</button>
          </div>
        </div>
        <div className="max-h-[44vh] overflow-y-auto rounded-lg border border-[#E6E8EE]">
          <table className="data-table">
            <thead><tr><th style={{ width: 30 }} aria-label="Pick" /><th>Lane</th><th>Unit</th><th>Carrier rate</th><th style={{ textAlign: 'right' }}>Buy</th><th>Valid to</th><th>Transit</th></tr></thead>
            <tbody>{shown.map((c) => {
              const dup = existing.has(key(c))
              return (
                <tr key={c.line_id} style={{ opacity: dup ? 0.45 : 1 }}>
                  <td><input type="checkbox" aria-label="Add lane" checked={sel.has(c.line_id)} onChange={() => toggle(sel, c.line_id, setSel)} /></td>
                  <td className="font-mono text-[12px]">{c.origin_code} &gt; {c.dest_code}{dup && <span className="ml-1 font-sans text-[10.5px] text-[#5B6474]">on card</span>}</td>
                  <td>{c.container_type ?? (p === 'LCL' ? 'w/m' : 'kg')}</td>
                  <td className="max-w-[260px] truncate text-[12px]" title={c.card_title}>{c.vendor ? `${c.vendor} · ` : ''}{c.card_title}</td>
                  <td className="text-right tabular-nums">{money(c.buy, c.currency, p === 'FCL' ? 0 : 2)}</td>
                  <td>{fmtDate(c.card_valid_to)}</td>
                  <td>{c.transit_days ? `${c.transit_days}d` : '–'}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
        <span className={lbl}>{shown.length} of {all.length} valid rates shown · {sel.size} ticked. Only validated cards inside their dates are listed. Margin uses the customer's rule; change it on the card.</span>
      </>)}
    </div>
  )
}
