import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Line, Product } from './rateCardModel'

type Props = { open: boolean; onOpenChange: (o: boolean) => void; lines: Line[]; onApply: (match: (l: Line) => boolean, patch: Partial<Line>) => void }

/** Set origin and destination charges on many lanes at once, by mode and container. */
export default function LocalChargesDialog({ open, onOpenChange, lines, onApply }: Props) {
  const [p, setP] = useState<Product>('FCL')
  const [ctr, setCtr] = useState('')
  const [o, setO] = useState(''); const [oc, setOc] = useState('USD')
  const [d, setD] = useState(''); const [dc, setDc] = useState('NZD')
  const ctrs = [...new Set(lines.filter((l) => l.product === 'FCL').map((l) => l.container_type ?? ''))].filter(Boolean)
  const match = (l: Line) => l.product === p && (p !== 'FCL' || !ctr || l.container_type === ctr)
  const n = lines.filter(match).length
  const lbl = 'text-[11.5px] text-[#5B6474]'

  function apply() {
    const patch: Partial<Line> = {}
    if (o.trim() !== '') { patch.origin_sell = Number(o); patch.origin_currency = oc.toUpperCase() }
    if (d.trim() !== '') { patch.dest_sell = Number(d); patch.dest_currency = dc.toUpperCase() }
    onApply(match, patch)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Set local charges</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Mode</span>
              <select className="input" value={p} onChange={(e) => { setP(e.target.value as Product); setCtr('') }}><option>FCL</option><option>LCL</option><option value="AIR">Air</option></select></label>
            {p === 'FCL' && <label className="flex flex-col gap-1"><span className={lbl}>Container</span>
              <select className="input" value={ctr} onChange={(e) => setCtr(e.target.value)}><option value="">All</option>{ctrs.map((c) => <option key={c}>{c}</option>)}</select></label>}
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <label className="flex flex-col gap-1"><span className={lbl}>Origin charges per unit</span><input className="input" value={o} onChange={(e) => setO(e.target.value)} placeholder="Leave blank to keep" /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Currency</span><input className="input" value={oc} onChange={(e) => setOc(e.target.value)} /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>NZ port, clearance and delivery per unit</span><input className="input" value={d} onChange={(e) => setD(e.target.value)} placeholder="Leave blank to keep" /></label>
            <label className="flex flex-col gap-1"><span className={lbl}>Currency</span><input className="input" value={dc} onChange={(e) => setDc(e.target.value)} /></label>
          </div>
          <span className={lbl}>Applies to {n} lane{n === 1 ? '' : 's'}. Edit single lanes in the table.</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!n || (o.trim() === '' && d.trim() === '')} onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
