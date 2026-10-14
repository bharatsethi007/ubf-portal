import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BrainboxKpis from './BrainboxKpis'
import BrainboxLibrary from './BrainboxLibrary'
import BrainboxRules from './BrainboxRules'
import LaneEvidence from './LaneEvidence'
import { fetchRules } from './brainboxApi'

type Tab = 'evidence' | 'learned' | 'rules'
const MODES = [{ v: '', label: 'All modes' }, { v: 'air', label: 'Air' }, { v: 'sea', label: 'Sea' }]
const DAYS = [30, 90, 180, 365]

/** Setup > Brainbox: what the team quotes, and the rules the system follows. */
export default function BrainboxPage() {
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'evidence'
  const mode = sp.get('mode') ?? ''
  const days = Number(sp.get('days')) || 180
  const [suggested, setSuggested] = useState(0)
  const [tick, setTick] = useState(0)
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }

  useEffect(() => {
    fetchRules(['suggested']).then((r) => setSuggested(r.length)).catch(() => {})
  }, [tick])

  const tabBtn = (t: Tab, label: string) => (
    <button type="button" onClick={() => set('tab', t === 'evidence' ? '' : t)}
      className={`quotes-tabs__btn ${tab === t ? 'quotes-tabs__btn--on' : ''}`}>{label}</button>
  )

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <div>
            <Link to="/setup" className="text-muted-foreground" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <ArrowLeft size={14} /> Setup
            </Link>
            <h1 style={{ marginTop: 4 }}>Brainbox</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14, maxWidth: 760 }}>
              What the team actually quotes, where each price comes from, and the rules the system follows.
            </p>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="quotes-tabs">
            {tabBtn('evidence', 'Lane evidence')}
            {tabBtn('learned', 'Quote library')}
            {tabBtn('rules', suggested > 0 ? `Rules · ${suggested} to approve` : 'Rules')}
          </div>
          {tab === 'learned' && (
            <div className="flex gap-2">
              <select className="input input--sm" style={{ width: 'auto' }} aria-label="Mode" value={mode} onChange={(e) => set('mode', e.target.value)}>
                {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
              <select className="input input--sm" style={{ width: 'auto' }} aria-label="Period" value={days} onChange={(e) => set('days', e.target.value === '180' ? '' : e.target.value)}>
                {DAYS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
              </select>
            </div>
          )}
        </div>

        {tab === 'evidence' ? (
          <LaneEvidence />
        ) : tab === 'learned' ? (
          <>
            <BrainboxKpis days={days} mode={mode || null} />
            <BrainboxLibrary days={days} mode={mode || null} onRuleSuggested={() => setTick((t) => t + 1)} />
          </>
        ) : (
          <BrainboxRules onChanged={() => setTick((t) => t + 1)} />
        )}
      </div>
    </div>
  )
}
