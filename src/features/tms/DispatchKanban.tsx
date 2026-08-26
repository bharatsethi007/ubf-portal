import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import ConsignmentCard from './ConsignmentCard'
import ConsignmentDrawer from './ConsignmentDrawer'
import { listKanbanConsignments, setConsignmentStatus, unassignConsignment, KANBAN_COLUMNS, kanbanBucket, type CardRow } from './dispatchApi'

export default function DispatchKanban() {
  const [rows, setRows] = useState<CardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const reqId = useRef(0)

  const load = () => {
    const my = ++reqId.current
    setLoading(true)
    listKanbanConsignments().then((d) => { if (my === reqId.current) setRows(d) }).catch(() => { if (my === reqId.current) setRows([]) }).finally(() => { if (my === reqId.current) setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const byCol = useMemo(() => {
    const m = new Map<string, CardRow[]>()
    KANBAN_COLUMNS.forEach((c) => m.set(c.key, []))
    rows.forEach((r) => m.get(kanbanBucket(r.status))?.push(r))
    return m
  }, [rows])

  async function move(id: string, colKey: string) {
    const card = rows.find((r) => r.id === id)
    if (!card) return
    const col = KANBAN_COLUMNS.find((c) => c.key === colKey)!
    if (kanbanBucket(card.status) === colKey) return
    if (colKey === 'assigned' && !card.assigned_driver_leg1) { toast.error('Assign a driver first (List view).'); return }
    const prev = card.status
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: col.status } : r)))
    try {
      if (colKey === 'unassigned') await unassignConsignment(id)
      else await setConsignmentStatus(id, col.status)
    } catch (e) {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: prev } : r)))
      toast.error(e instanceof Error ? e.message : 'Could not change status')
    }
  }

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: 480 }}>
          {KANBAN_COLUMNS.map((col) => {
            const items = byCol.get(col.key) ?? []
            const on = overCol === col.key
            return (
              <section key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key) }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => { e.preventDefault(); setOverCol(null); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, col.key) }}
                className={`flex w-72 shrink-0 flex-col rounded-lg border ${on ? 'border-[#0A2472] bg-[#0A2472]/5' : 'border-neutral-200 bg-neutral-50'}`}>
                <header className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-[#0A2472]">
                  {col.label}<span className="rounded-full bg-white px-2 py-0.5 text-xs text-neutral-600">{items.length}</span>
                </header>
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                  {loading ? <p className="p-2 text-xs text-neutral-400">Loading…</p>
                   : items.length === 0 ? <p className="p-2 text-xs text-neutral-400">—</p>
                   : items.map((c) => <ConsignmentCard key={c.id} card={c} onOpen={() => setDrawerId(c.id)} />)}
                </div>
              </section>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-400">Drag a card between columns to change status.</p>
      </div>
      <ConsignmentDrawer id={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  )
}
