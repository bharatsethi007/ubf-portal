import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn quotes-page__new-btn" style={hasErrors ? { backgroundColor: '#d97706' } : undefined} disabled={saving} onClick={onConfirm}>
            {saving ? 'Assigning…' : hasErrors ? 'Assign anyway' : 'Confirm assign'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
