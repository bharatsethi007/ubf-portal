import { useState } from 'react'
import { LayoutList, Columns3, CalendarDays } from 'lucide-react'
import DispatchBoardView from './DispatchBoardView'
import DispatchKanban from './DispatchKanban'
import DispatchCalendar from './DispatchCalendar'

type Mode = 'board' | 'kanban' | 'calendar'

export default function DispatchBoard() {
  const [mode, setMode] = useState<Mode>('board')
  const icons: { key: Mode; label: string; Icon: typeof LayoutList }[] = [
    { key: 'board', label: 'List', Icon: LayoutList },
    { key: 'kanban', label: 'Kanban', Icon: Columns3 },
    { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
  ]
  return (
    <div>
      <div className="quotes-page" style={{ paddingBottom: 0 }}>
        <div className="mb-2 flex justify-end gap-1">
          {icons.map(({ key, label, Icon }) => (
            <button key={key} type="button" title={label} aria-label={label} aria-pressed={mode === key} onClick={() => setMode(key)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border ${mode === key ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
      {mode === 'board' && <DispatchBoardView />}
      {mode === 'kanban' && <DispatchKanban />}
      {mode === 'calendar' && <DispatchCalendar />}
    </div>
  )
}
