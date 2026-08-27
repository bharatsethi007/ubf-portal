import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'
import type { CardRow, DriverRow } from './dispatchApi'
import { validateAssignment } from './assignValidation'

type Props = { card: CardRow | null; driver: DriverRow | null; saving: boolean; onCancel: () => void; onConfirm: () => void }

export default function AssignConfirmDialog({ card, driver, saving, onCancel, onConfirm }: Props) {
  const open = Boolean(card && driver)
  const v = card && driver ? validateAssignment(card, driver) : { errors: [], warnings: [] }
  const hasErrors = v.errors.length > 0
  const clean = !hasErrors && v.warnings.length === 0
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign {card?.consignment_no} to {driver?.first_name} {driver?.last_name}</DialogTitle></DialogHeader>
        <div className="space-y-2 py-1 text-sm">
          <p className="text-neutral-600">Truck: {driver?.vehicle?.registration_number ?? 'none logged on'}</p>
          {v.errors.map((e) => <div key={e} className="flex items-start gap-2 text-red-700"><XCircle size={15} className="mt-0.5 shrink-0" />{e}</div>)}
          {v.warnings.map((w) => <div key={w} className="flex items-start gap-2 text-amber-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{w}</div>)}
          {clean && <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={15} />No constraint issues.</div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className={hasErrors
              ? '!bg-amber-600 !text-white hover:!bg-amber-600/90 !border-amber-600'
              : '!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy'}
          >
            {saving ? 'Assigning…' : hasErrors ? 'Assign anyway' : 'Confirm assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
