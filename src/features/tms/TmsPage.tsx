import { useState } from 'react'
import TmsOpsBoard from './TmsOpsBoard'
import DispatchBoard from './DispatchBoard'

export default function TmsPage() {
  const [view, setView] = useState<'ops' | 'dispatch'>('ops')
  return (
    <div className="min-h-screen bg-white px-6 py-4">
      <div className="mb-4 inline-flex rounded-lg border border-neutral-200 p-0.5">
        {(['ops', 'dispatch'] as const).map((v) => {
          const on = view === v
          return (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-[#0A2472]/[0.06] text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
              {v === 'ops' ? 'Operations' : 'Dispatch'}
            </button>
          )
        })}
      </div>
      {view === 'ops' ? <TmsOpsBoard /> : <DispatchBoard />}
    </div>
  )
}
