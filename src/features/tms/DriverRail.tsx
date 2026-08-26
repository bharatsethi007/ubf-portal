import { useState } from 'react'
import type { DriverRow } from './dispatchApi'

type Props = { drivers: DriverRow[]; selectedId: string | null; onSelect: (id: string | null) => void; onDropCard: (driverId: string, cardId: string) => void }

export default function DriverRail({ drivers, selectedId, onSelect, onDropCard }: Props) {
  const [over, setOver] = useState<string | null>(null)
  return (
    <div className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-neutral-200 pr-2">
      {drivers.length === 0 && <p className="px-2 py-3 text-sm text-neutral-400">No active drivers.</p>}
      {drivers.map((d) => {
        const on = selectedId === d.id
        const dropping = over === d.id
        return (
          <button key={d.id} type="button" onClick={() => onSelect(on ? null : d.id)}
            onDragOver={(e) => { e.preventDefault(); setOver(d.id) }}
            onDragLeave={() => setOver((c) => (c === d.id ? null : c))}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) onDropCard(d.id, id) }}
            className={`flex items-center gap-2 rounded-md px-2 py-2 text-left ${dropping ? 'ring-2 ring-[#0A2472] bg-[#0A2472]/5' : on ? 'bg-[#0A2472]/10 ring-1 ring-[#0A2472]/30' : 'hover:bg-neutral-50'}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A2472] text-xs font-semibold text-white">{(d.first_name[0] ?? '') + (d.last_name[0] ?? '')}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{d.first_name} {d.last_name[0]}.</span>
              <span className="block truncate text-xs text-neutral-500">{d.current_registration ?? 'No truck'}</span>
            </span>
            {d.count > 0 && <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-700">{d.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
