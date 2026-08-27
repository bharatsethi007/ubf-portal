import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import type { CardRow } from './dispatchApi'

type Props = { card: CardRow | null; saving: boolean; onCancel: () => void; onConfirm: () => void }

export default function CompleteConfirmDialog({ card, saving, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={Boolean(card)} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Complete {card?.consignment_no}?</DialogTitle></DialogHeader>
        <div className="space-y-2 py-1 text-sm text-neutral-600">
          <div className="flex items-start gap-2 text-emerald-700">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            <span>Do you want to manually complete this job? It will be marked as complete on the driver's app as well.</span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={saving} className="!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy" onClick={onConfirm}>
            {saving ? 'Completing…' : 'Mark complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
