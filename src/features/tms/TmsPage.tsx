import { useState } from 'react'
import { BookMarked } from 'lucide-react'
import TmsOpsBoard from './TmsOpsBoard'
import DispatchBoard from './DispatchBoard'
import CheckInsView from './CheckInsView'
import AddressBookManager from './AddressBookManager'

type View = 'ops' | 'dispatch' | 'checkins'
const VIEWS: { key: View; label: string }[] = [
  { key: 'ops', label: 'Operations' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'checkins', label: 'Check-ins' },
]

export default function TmsPage() {
  const [view, setView] = useState<View>('ops')
  const [bookOpen, setBookOpen] = useState(false)
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
        <button type="button" onClick={() => setBookOpen(true)} title="Address book" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          <BookMarked size={16} /> Address book
        </button>
      </div>
      {view === 'ops' && <TmsOpsBoard />}
      {view === 'dispatch' && <DispatchBoard />}
      {view === 'checkins' && <CheckInsView />}
      <AddressBookManager open={bookOpen} onClose={() => setBookOpen(false)} />
    </div>
  )
}
