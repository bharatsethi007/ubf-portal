import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { fetchCheckinLines, confirmCheckin, cube, type CheckinLine, type ActualDraft } from './checkinApi'

type Props = { consignmentId: string | null; consignmentNo?: string | null; onClose: () => void; onDone: () => void }
const num = (v: number | null) => (v == null ? '' : String(v))
const FIELDS = ['units', 'length_cm', 'width_cm', 'height_cm', 'weight_kg'] as const

export default function CheckinVerifyDialog({ consignmentId, consignmentNo, onClose, onDone }: Props) {
  const open = Boolean(consignmentId)
  const [lines, setLines] = useState<CheckinLine[]>([])
  const [drafts, setDrafts] = useState<ActualDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!consignmentId) { setLines([]); setDrafts([]); return }
    let cancelled = false
    setLoading(true)
    fetchCheckinLines(consignmentId).then((ls) => {
      if (cancelled) return
      setLines(ls)
      setDrafts(ls.map((l) => ({
        id: l.id,
        units: num(l.actual_units ?? l.units),
        length_cm: num(l.actual_length_cm ?? l.length_cm),
        width_cm: num(l.actual_width_cm ?? l.width_cm),
        height_cm: num(l.actual_height_cm ?? l.height_cm),
        weight_kg: num(l.actual_weight_kg ?? l.weight_kg),
      })))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [consignmentId])

  const set = (i: number, patch: Partial<ActualDraft>) => setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  const oldCbm = lines.reduce((t, l) => t + (l.total_cube_m3 ?? 0), 0)
  const newCbm = drafts.reduce((t, d) => t + cube(d.length_cm, d.width_cm, d.height_cm, d.units), 0)

  async function confirm() {
    if (!consignmentId || saving) return
    setSaving(true)
    try { await confirmCheckin(consignmentId, drafts); toast.success('Checked in'); onDone() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Check-in failed'); setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Check in {consignmentNo ?? 'consignment'}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-neutral-500">Enter the measured dimensions. Originals are kept — differences show struck through.</p>
        {loading ? (
          <p className="py-6 text-sm text-neutral-400">Loading…</p>
        ) : lines.length === 0 ? (
          <p className="py-6 text-sm text-neutral-400">No cargo lines to verify.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 px-1 text-[11px] uppercase tracking-wide text-neutral-400">
              <span>Type</span><span>Units</span><span>L</span><span>W</span><span>H</span><span>Kg</span><span>CBM</span>
            </div>
            {lines.map((l, i) => {
              const d = drafts[i]
              const c = cube(d.length_cm, d.width_cm, d.height_cm, d.units)
              return (
                <div key={l.id} className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] items-start gap-2">
                  <span className="pt-2 text-sm capitalize">{l.type}</span>
                  {FIELDS.map((f) => {
                    const orig = (l as any)[f] as number | null
                    const val = (d as any)[f] as string
                    const a = parseFloat(val)
                    const changed = orig != null && !Number.isNaN(a) && a !== orig
                    return (
                      <span key={f} className="flex flex-col">
                        <input className="input w-full" inputMode="decimal" value={val} onChange={(e) => set(i, { [f]: e.target.value } as any)} />
                        {changed && <span className="mt-0.5 text-[10px] text-neutral-400 line-through">{orig}</span>}
                      </span>
                    )
                  })}
                  <span className="pt-2 text-sm tabular-nums">{c.toFixed(4)}{l.total_cube_m3 != null && c !== l.total_cube_m3 && <span className="ml-1 text-[10px] text-neutral-400 line-through">{l.total_cube_m3}</span>}</span>
                </div>
              )
            })}
            <div className="flex justify-end gap-3 border-t border-neutral-100 pt-2 text-sm">
              <span className="text-neutral-500">Total CBM</span>
              <span className="tabular-nums">{oldCbm !== newCbm && <span className="mr-1 text-neutral-400 line-through">{oldCbm.toFixed(4)}</span>}{newCbm.toFixed(4)}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50" onClick={onClose}>Cancel</button>
          <button type="button" disabled={saving || lines.length === 0} className="rounded-lg bg-[#0A2472] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2472]/90 disabled:opacity-50" onClick={confirm}>{saving ? 'Saving…' : 'Confirm check-in'}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
