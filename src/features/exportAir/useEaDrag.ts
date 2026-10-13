import { useCallback, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import type { EaGroup } from './eaGroups'
import type { EaRow } from './eaTypes'

const MIME = 'application/x-ea-bookings'
const locked = (r: EaRow) => r.consol_status === 'exported' || r.consol_status === 'departed'

/**
 * Drag bookings between consols and back to unallocated. Dragging a ticked row moves every ticked row.
 * Lane is checked (a NAN booking can't go on a TBU flight); a booking with no destination takes the consol's.
 */
export function useEaDrag(rows: EaRow[], sel: Set<string>, onDone: () => Promise<void> | void) {
  const [dragIds, setDragIds] = useState<string[]>([])
  const [over, setOver] = useState<string | null>(null)

  const start = useCallback((r: EaRow) => (e: DragEvent) => {
    const ids = (sel.has(r.id) ? rows.filter((x) => sel.has(x.id)) : [r]).filter((x) => !locked(x)).map((x) => x.id)
    if (!ids.length) { e.preventDefault(); return }
    setDragIds(ids)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(MIME, JSON.stringify(ids))
    e.dataTransfer.setData('text/plain', rows.filter((x) => ids.includes(x.id)).map((x) => x.booking_ref).join(', '))
    // Compact drag chip instead of the whole row.
    const chip = document.createElement('div')
    chip.textContent = ids.length > 1 ? `${ids.length} bookings` : r.booking_ref
    chip.style.cssText = 'position:fixed;top:-100px;left:-100px;padding:6px 10px;border-radius:8px;background:#0A2472;color:#fff;font:600 12px Geist,system-ui,sans-serif;box-shadow:0 8px 24px rgba(10,36,114,.3)'
    document.body.appendChild(chip)
    e.dataTransfer.setDragImage(chip, 12, 12)
    window.setTimeout(() => chip.remove(), 0)
  }, [rows, sel])

  const end = useCallback(() => { setDragIds([]); setOver(null) }, [])

  const canDrop = useCallback((g: EaGroup) => {
    if (!dragIds.length) return false
    if (g.kind === 'consol') return g.consol.status !== 'exported' && g.consol.status !== 'departed'
    return true
  }, [dragIds])

  const target = useCallback((g: EaGroup) => ({
    onDragOver: (e: DragEvent) => {
      if (!canDrop(g)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (over !== g.key) setOver(g.key)
    },
    onDragLeave: (e: DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null) && over === g.key) setOver(null)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      let ids = dragIds
      try { ids = JSON.parse(e.dataTransfer.getData(MIME) || '[]') as string[] } catch { /* use state */ }
      end()
      if (ids.length) void move(ids, g)
    },
  }), [canDrop, dragIds, over, end]) // eslint-disable-line react-hooks/exhaustive-deps

  async function move(ids: string[], g: EaGroup) {
    const moving = rows.filter((r) => ids.includes(r.id))
    const before = moving.map((r) => ({ id: r.id, consol_id: r.consol_id, destination: r.destination }))
    try {
      if (g.kind === 'consol') {
        const c = g.consol
        const dest = c.destination.toUpperCase()
        const already = moving.filter((r) => r.consol_id === c.id)
        const wrong = moving.filter((r) => r.destination && r.destination.toUpperCase() !== dest)
        const ok = moving.filter((r) => r.consol_id !== c.id && !wrong.includes(r))
        if (wrong.length) toast.error(`${wrong.map((r) => r.booking_ref).join(', ')} ${wrong.length > 1 ? 'go' : 'goes'} to ${wrong[0].destination}, not ${dest}. Not moved.`)
        if (!ok.length) { if (!wrong.length && already.length) toast.message(`Already on ${c.flight_no}`); return }
        const noDest = ok.filter((r) => !r.destination).map((r) => r.id)
        if (noDest.length) {
          const { error } = await supabase.from('bookings').update({ destination: dest }).in('id', noDest)
          if (error) throw new Error(error.message)
        }
        const { error } = await supabase.from('bookings').update({ consol_id: c.id }).in('id', ok.map((r) => r.id))
        if (error) throw new Error(error.message)
        toast.success(`${ok.length > 1 ? `${ok.length} bookings` : ok[0].booking_ref} moved to ${c.flight_no}`, { action: { label: 'Undo', onClick: () => void undo(before.filter((b) => ok.some((r) => r.id === b.id))) } })
      } else {
        const onConsol = moving.filter((r) => r.consol_id)
        if (!onConsol.length) { toast.message('Already unallocated'); return }
        const { error } = await supabase.from('bookings').update({ consol_id: null }).in('id', onConsol.map((r) => r.id))
        if (error) throw new Error(error.message)
        toast.success(`${onConsol.length > 1 ? `${onConsol.length} bookings` : onConsol[0].booking_ref} unallocated`, { action: { label: 'Undo', onClick: () => void undo(before.filter((b) => onConsol.some((r) => r.id === b.id))) } })
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      await onDone()
    }
  }

  async function undo(prev: { id: string; consol_id: string | null; destination: string | null }[]) {
    try {
      for (const p of prev) {
        const { error } = await supabase.from('bookings').update({ consol_id: p.consol_id, destination: p.destination }).eq('id', p.id)
        if (error) throw new Error(error.message)
      }
      toast.success('Move undone')
    } catch (e) { toast.error((e as Error).message) } finally { await onDone() }
  }

  return { dragIds, over, start, end, target, canDrop }
}
