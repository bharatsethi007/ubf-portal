import { useState } from 'react'
import { BookMarked, LayoutList, Columns3, CalendarDays } from 'lucide-react'
import TmsOpsBoard from './TmsOpsBoard'
import DispatchBoard, { type DispatchMode } from './DispatchBoard'
import CheckInsView from './CheckInsView'
import AddressBookManager from './AddressBookManager'

type View = 'ops' | 'dispatch' | 'checkins'
const VIEWS: { key: View; label: string }[] = [
  { key: 'ops', label: 'Operations' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'checkins', label: 'Check-ins' },
]

const DISPATCH_MODES: { key: DispatchMode; label: string; Icon: typeof LayoutList }[] = [
  { key: 'board', label: 'List', Icon: LayoutList },
  { key: 'kanban', label: 'Kanban', Icon: Columns3 },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
]

export default function TmsPage() {
  const [view, setView] = useState<View>('ops')
  const [bookOpen, setBookOpen] = useState(false)
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>('board')
  return (
    <div className="min-h-screen bg-white px-6 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-neutral-200 p-0.5">
          {VIEWS.map(({ key, label }) => {
            const on = view === key
            return (
              <button key={key} type="button" onClick={() => setView(key)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-[#0A2472]/[0.06] text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
                {label}
              </button>
            )
          })}
        </div>
        {view === 'ops' && (
          <button type="button" onClick={() => setBookOpen(true)} title="Address book" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
            <BookMarked size={16} /> Address book
          </button>
        )}
        {view === 'dispatch' && (
          <div className="inline-flex gap-1">
            {DISPATCH_MODES.map(({ key, label, Icon }) => (
              <button key={key} type="button" title={label} aria-label={label} aria-pressed={dispatchMode === key} onClick={() => setDispatchMode(key)}
                className={`flex h-8 w-8 items-center justify-center rounded-md border ${dispatchMode === key ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        )}
      </div>
      {view === 'ops' && <TmsOpsBoard />}
      {view === 'dispatch' && <DispatchBoard mode={dispatchMode} />}
      {view === 'checkins' && <CheckInsView />}
      <AddressBookManager open={bookOpen} onClose={() => setBookOpen(false)} />
    </div>
  )
}
