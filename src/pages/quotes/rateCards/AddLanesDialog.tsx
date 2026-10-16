import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CONTAINERS, computeSell, fmtDate, laneKey, money, type Line, type Product, type Rule } from './rateCardModel'
import { findCandidates, type Candidate } from './rateCardsApi'
import ExcelLanesImport from './ExcelLanesImport'

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void
  rules: Partial<Record<Product, Rule>>; existing: Set<string>; nextSort: number
  onAdd: (lines: Line[]) => void
}

const blank = (p: Product, sort: number): Line => ({
  sort, product: p, origin_code: '', dest_code: '', container_type: p === 'FCL' ? '40HC' : null, carrier: null,
  transit_days: null, via: null, frequency: null, source_table: null, source_line_id: null, source_card_id: null,
  buy: null, buy_currency: null, margin_method: 'rule', margin_value: null, freight_sell: null, sell_min: null,
  sell_currency: 'USD', origin_sell: null, origin_currency: 'USD', dest_sell: null, dest_currency: 'NZD', show: true, notes: null,
})

/** Add lanes from live carrier rates (cheapest preselected) or by hand. */
export default function AddLanesDialog({ open, onOpenChange, rules, existing, nextSort, onAdd }: Props) {
  const [tab, setTab] = useState<'carrier' | 'manual' | 'excel'>('carrier')
  const [xl, setXl] = useState<Line[]>([])
  const [p, setP] = useState<Product>('FCL')
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('NZAKL')
  const [ctr, setCtr] = useState('')
  const [rows, setRows] = useState<Candidate[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [man, setMan] = useState<Line>(blank('FCL', nextSort))

  useEffect(() => { if (open) { setRows([]); setSel(new Set()); setXl([]); setMan(blank('FCL', nextSort)) } }, [open, nextSort])

  const destCode = (d: string) => d.trim().toUpperCase()

  async function search() {
    setBusy(true)
    try {
      const r = await findCandidates(p, origin.trim(), destCode(dest), p === 'FCL' ? ctr : '')
      setRows(r)
      // Cheapest per lane, skipping lanes already on the card.
      const best = new Map<string, Candidate>()
      for (const c of r) {
        const k = laneKey({ product: p, origin_code: c.origin_code, dest_code: c.dest_code, container_type: c.container_type })
        if (existing.has(k)) continue
        if (!best.has(k) || Number(c.buy) < Number(best.get(k)!.buy)) best.set(k, c)
      }
      setSel(new Set([...best.values()].map((c) => c.line_id)))
      if (!r.length) toast.message('No live carrier rates for that search')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  function add() {
    if (tab === 'excel') { onAdd(xl); onOpenChange(false); return }
    if (tab === 'manual') {
      if (!man.origin_code || !man.dest_code || man.freight_sell == null) { toast.error('Origin, destination and sell are needed'); return }
      onAdd([{ ...man, origin_code: man.origin_code.toUpperCase(), dest_code: destCode(man.dest_code), margin_method: 'sell' }])
      onOpenChange(false); return
    }
    const chosen = rows.filter((c) => sel.has(c.line_id))
    onAdd(chosen.map((c, i) => {
      const base: Line = {
        ...blank(p, nextSort + i), origin_code: c.origin_code, dest_code: c.dest_code, container_type: c.container_type,
        transit_days: c.transit_days, via: c.via, frequency: c.frequency, source_table: c.source_table, source_line_id: c.line_id,
        source_card_id: c.card_id, buy: Number(c.buy), buy_currency: c.currency, sell_currency: c.currency ?? 'USD',
        origin_currency: c.currency ?? 'USD', carrier: c.vendor,
      }
      return { ...base, freight_sell: computeSell(base, rules[p] ?? null) }
    }))
    onOpenChange(false)
  }

  const lbl = 'text-[11.5px] text-[#5B6474]'
  const segBtn = (on: boolean) => `h-7 rounded-md px-3 text-[12.5px] ${on ? 'bg-white text-[#0A2472] shadow-sm' : 'text-[#5B6474]'}`
  const setM = (patch: Partial<Line>) => setMan((m) => ({ ...m, ...patch }))
  const n = (v: string) => (v.trim() === '' ? null : Number(v))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Add lanes</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex gap-0.5 rounded-lg bg-[#F1F3F7] p-[3px]">
            <button type="button" className={segBtn(tab === 'carrier')} onClick={() => setTab('carrier')}>From carrier rates</button>
            <button type="button" className={segBtn(tab === 'manual')} onClick={() => setTab('manual')}>By hand</button>
            <button type="button" className={segBtn(tab === 'excel')} onClick={() => setTab('excel')}>From Excel</button>
          </div>
          {tab !== 'excel' && <div className="inline-flex gap-0.5 rounded-lg bg-[#F1F3F7] p-[3px]">
            {(['FCL', 'LCL', 'AIR'] as Product[]).map((x) => (
              <button key={x} type="button" className={segBtn((tab === 'carrier' ? p : man.product) === x)}
                onClick={() => { if (tab === 'carrier') { setP(x); setRows([]); setDest(x === 'AIR' ? 'AKL' : 'NZAKL'); setOrigin('') } else setMan(blank(x, nextSort)) }}>{x === 'AIR' ? 'Air' : x}</button>
            ))}
          </div>}
        </div>

        {tab === 'excel' ? <ExcelLanesImport rules={rules} existing={existing} nextSort={nextSort} onRows={setXl} /> : tab === 'carrier' ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3">
              <label className="flex flex-col gap-1"><span className={lbl}>Origin (blank = all)</span><input className="input" value={origin} placeholder={p === 'AIR' ? 'PVG' : 'CNSHA'} onChange={(e) => setOrigin(e.target.value)} /></label>
              <label className="flex flex-col gap-1"><span className={lbl}>Destination</span><input className="input" value={dest} placeholder="NZAKL" onChange={(e) => setDest(e.target.value)} /></label>
              {p === 'FCL'
                ? <label className="flex flex-col gap-1"><span className={lbl}>Container</span><select className="input" value={ctr} onChange={(e) => setCtr(e.target.value)}><option value="">All</option>{CONTAINERS.map((c) => <option key={c}>{c}</option>)}</select></label>
                : <span />}
              <Button type="button" disabled={busy} onClick={() => void search()}><Search size={14} /> {busy ? 'Searching…' : 'Search'}</Button>
            </div>
            {rows.length > 0 && (
              <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-[#E6E8EE]">
                <table className="data-table">
                  <thead><tr><th style={{ width: 30 }} aria-label="Pick" /><th>Lane</th><th>Unit</th><th>Carrier rate</th><th style={{ textAlign: 'right' }}>Buy</th><th>Valid to</th><th>Transit</th></tr></thead>
                  <tbody>
                    {rows.map((c) => {
                      const dup = existing.has(laneKey({ product: p, origin_code: c.origin_code, dest_code: c.dest_code, container_type: c.container_type }))
                      return (
                        <tr key={c.line_id} style={{ opacity: dup ? 0.45 : 1 }}>
                          <td><input type="checkbox" aria-label="Add lane" checked={sel.has(c.line_id)} onChange={(e) => setSel((s) => { const x = new Set(s); if (e.target.checked) x.add(c.line_id); else x.delete(c.line_id); return x })} /></td>
                          <td className="font-mono text-[12px]">{c.origin_code} &gt; {c.dest_code}{dup && <span className="ml-1 font-sans text-[10.5px] text-[#5B6474]">on card</span>}</td>
                          <td>{c.container_type ?? (p === 'LCL' ? 'w/m' : 'kg')}</td>
                          <td className="max-w-[260px] truncate text-[12px]" title={c.card_title}>{c.vendor ? `${c.vendor} · ` : ''}{c.card_title}</td>
                          <td className="text-right tabular-nums">{money(c.buy, c.currency, p === 'FCL' ? 0 : 2)}</td>
                          <td>{fmtDate(c.card_valid_to)}</td>
                          <td>{c.transit_days ? `${c.transit_days}d` : '–'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <span className={lbl}>Cheapest live rate per lane is ticked. Margin uses the customer's rule; change it on the card.</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Origin</span><input className="input" value={man.origin_code} placeholder="CNSHA" onChange={(e) => setM({ origin_code: e.target.value })} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Destination</span><input className="input" value={man.dest_code} placeholder="NZAKL" onChange={(e) => setM({ dest_code: e.target.value })} /></label>
            {man.product === 'FCL'
              ? <label className="flex flex-col gap-1"><span className={lbl}>Container</span><select className="input" value={man.container_type ?? ''} onChange={(e) => setM({ container_type: e.target.value })}>{CONTAINERS.map((c) => <option key={c}>{c}</option>)}</select></label>
              : <span />}
            <label className="flex flex-col gap-1"><span className={lbl}>Currency</span><input className="input" value={man.sell_currency} onChange={(e) => setM({ sell_currency: e.target.value.toUpperCase(), origin_currency: e.target.value.toUpperCase() })} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Buy (optional)</span><input className="input" value={man.buy ?? ''} onChange={(e) => setM({ buy: n(e.target.value) })} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Freight sell</span><input className="input" value={man.freight_sell ?? ''} onChange={(e) => setM({ freight_sell: n(e.target.value) })} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Transit days</span><input className="input" value={man.transit_days ?? ''} onChange={(e) => setM({ transit_days: n(e.target.value) })} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Via</span><input className="input" value={man.via ?? ''} onChange={(e) => setM({ via: e.target.value || null })} /></label>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={(tab === 'carrier' && !sel.size) || (tab === 'excel' && !xl.length)} onClick={add}>{tab === 'carrier' ? `Add ${sel.size} lane${sel.size === 1 ? '' : 's'}` : tab === 'excel' ? `Add ${xl.length} lane${xl.length === 1 ? '' : 's'}` : 'Add lane'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
