import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CONTAINERS, type Line, type Product, type Rule } from './rateCardModel'
import CarrierRatesPicker from './CarrierRatesPicker'
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

/** Add lanes: from valid carrier rates, by hand, or from Excel. */
export default function AddLanesDialog({ open, onOpenChange, rules, existing, nextSort, onAdd }: Props) {
  const [tab, setTab] = useState<'carrier' | 'manual' | 'excel'>('carrier')
  const [p, setP] = useState<Product>('FCL')
  const [picked, setPicked] = useState<Line[]>([])
  const [xl, setXl] = useState<Line[]>([])
  const [man, setMan] = useState<Line>(blank('FCL', nextSort))

  useEffect(() => { if (open) { setPicked([]); setXl([]); setMan(blank('FCL', nextSort)) } }, [open, nextSort])

  function add() {
    if (tab === 'excel') { onAdd(xl); onOpenChange(false); return }
    if (tab === 'manual') {
      if (!man.origin_code || !man.dest_code || man.freight_sell == null) { toast.error('Origin, destination and sell are needed'); return }
      onAdd([{ ...man, origin_code: man.origin_code.trim().toUpperCase(), dest_code: man.dest_code.trim().toUpperCase(), margin_method: 'sell' }])
      onOpenChange(false); return
    }
    onAdd(picked); onOpenChange(false)
  }

  const lbl = 'text-[11.5px] text-[#5B6474]'
  const segBtn = (on: boolean) => `h-7 rounded-md px-3 text-[12.5px] ${on ? 'bg-white text-[#0A2472] shadow-sm' : 'text-[#5B6474]'}`
  const setM = (patch: Partial<Line>) => setMan((m) => ({ ...m, ...patch }))
  const n = (v: string) => (v.trim() === '' ? null : Number(v))
  const count = tab === 'carrier' ? picked.length : tab === 'excel' ? xl.length : 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
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
                onClick={() => { if (tab === 'carrier') { setP(x); setPicked([]) } else setMan(blank(x, nextSort)) }}>{x === 'AIR' ? 'Air' : x}</button>
            ))}
          </div>}
        </div>

        {tab === 'excel' ? <ExcelLanesImport rules={rules} existing={existing} nextSort={nextSort} onRows={setXl} />
          : tab === 'carrier' ? <CarrierRatesPicker product={p} rules={rules} existing={existing} nextSort={nextSort} blank={blank} onLines={setPicked} />
          : (
          <div className="grid grid-cols-4 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Origin</span><input className="input" value={man.origin_code} placeholder={man.product === 'AIR' ? 'PVG' : 'CNSHA'} onChange={(e) => setM({ origin_code: e.target.value })} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Destination</span><input className="input" value={man.dest_code} placeholder={man.product === 'AIR' ? 'AKL' : 'NZAKL'} onChange={(e) => setM({ dest_code: e.target.value })} /></label>
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
          <Button type="button" disabled={tab !== 'manual' && !count} onClick={add}>{tab === 'manual' ? 'Add lane' : `Add ${count} lane${count === 1 ? '' : 's'}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
