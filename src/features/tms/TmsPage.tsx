import { useState } from 'react'
import TmsOpsBoard from './TmsOpsBoard'
import DispatchBoard from './DispatchBoard'

export default function TmsPage() {
  const [view, setView] = useState<'ops' | 'dispatch'>('ops')
  return (
    <div>
      <div className="quotes-page" style={{ paddingBottom: 0 }}>
        <div className="mb-2 inline-flex rounded-md border border-neutral-200 p-0.5">
          {(['ops', 'dispatch'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-sm font-medium ${view === v ? 'bg-[#0A2472] text-white' : 'text-neutral-600 hover:bg-neutral-50'}`}>
              {v === 'ops' ? 'Operations' : 'Dispatch'}
            </button>
          ))}
        </div>
      </div>
      {view === 'ops' ? <TmsOpsBoard /> : <DispatchBoard />}
    </div>
  )
}
