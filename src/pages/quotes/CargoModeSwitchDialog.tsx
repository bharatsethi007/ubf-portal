import { ArrowRightLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { CargoEntryMode } from './QuoteCargoEntry'
import type { CargoSums } from './cargoModeSwitch'

type Props = {
  target: CargoEntryMode | null
  sums: CargoSums
  mode: 'air' | 'sea'
  onCancel: () => void
  onConfirm: () => void
}

const n = (v: number, d: number) => v.toLocaleString('en-NZ', { maximumFractionDigits: d })

/** Asks before switching Total <-> Individual, and says exactly what the numbers become. */
export default function CargoModeSwitchDialog({ target, sums, mode, onCancel, onConfirm }: Props) {
  const toTotal = target === 'total'
  const figures = `${n(sums.pieces, 0)} pcs · ${n(sums.kg, 2)} kg · ${n(sums.cbm, 3)} m³`
  return (
    <Dialog open={target != null} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to {toTotal ? 'Total' : 'Individual'} entry?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 text-sm text-neutral-600">
          <div className="flex items-start gap-2">
            <ArrowRightLeft size={15} className="mt-0.5 shrink-0 text-[#0A2472]" />
            <span>
              {toTotal
                ? `Your ${sums.lines === 1 ? 'line becomes' : `${sums.lines} lines combine into`} one total. ${mode === 'air' ? 'Chargeable weight' : 'CBM'} is worked out from these totals from now on.`
                : 'Your totals become line 1. Add dimensions or more lines and the totals follow them from now on.'}
            </span>
          </div>
          <div className="rounded-xl border border-[#0A2472]/[0.06] bg-[#0A2472]/[0.04] px-3 py-2 font-mono text-[13px] text-[#141B2D]">{figures}</div>
          {toTotal && sums.lines > 1 && <p className="text-xs text-[#6B7486]">Per-line dimensions are dropped.</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Keep {toTotal ? 'Individual' : 'Total'}</Button>
          <Button type="button" className="!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy" onClick={onConfirm}>
            Switch to {toTotal ? 'Total' : 'Individual'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
